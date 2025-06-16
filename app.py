import os
import io
import cv2
import torch
import base64
import random
import numpy as np
import joblib
import torch.nn.functional as F
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from PIL import Image
from flask_socketio import SocketIO

# Initialize Flask App
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app)

# Load Models
text_model = joblib.load("fine-tuned-deepfake-detector1.joblib")
text_vectorizer = joblib.load("fine-tuned-deepfake-detector1_processor.joblib")

# Image Model
from transformers import AutoImageProcessor, AutoModelForImageClassification
image_model_name = "HrutikAdsare/deepfake-detector-faceforensics"
image_processor = AutoImageProcessor.from_pretrained(image_model_name)
image_model = AutoModelForImageClassification.from_pretrained(image_model_name)
image_labels = ["Real", "Deepfake"]

# Video Model
from transformers import AutoModelForVideoClassification, AutoProcessor
video_model = AutoModelForVideoClassification.from_pretrained(
    "./fine_tuned_deepfake_vit",
    trust_remote_code=True,
    use_safetensors=True
)
video_processor = AutoProcessor.from_pretrained("./fine_tuned_deepfake_vit")

def extract_video_frames(video_path, num_frames=16):
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    
    if total_frames > 0:
        indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
    
    current_frame = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if current_frame in indices:
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(image)
            frames.append(image)
            progress = int((len(frames) / num_frames) * 100)
            socketio.emit('progress', {'progress': progress})
        current_frame += 1
    cap.release()
    return frames

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict-text", methods=["POST"])
def predict_text():
    data = request.get_json()
    if "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    text = [data["text"]]
    features = text_vectorizer.transform(text)
    prediction = text_model.predict(features)[0]
    probabilities = text_model.predict_proba(features)[0].tolist()
    
    return jsonify({
        "prediction": "Fake" if prediction == 1 else "Real",
        "probability": {
            "Fake": probabilities[1],
            "Real": probabilities[0]
        }
    })

@app.route("/predict-image", methods=["POST"])
def predict_image():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    image_pil = Image.open(io.BytesIO(file.read())).convert("RGB")
    
    inputs = image_processor(images=image_pil, return_tensors="pt")
    with torch.no_grad():
        outputs = image_model(**inputs)
        probs = F.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(probs, dim=-1).item()
    
    model_prediction = image_labels[predicted_class]
    model_confidence = float(probs[0][predicted_class])
    authenticity_score = (100 - (model_confidence * 100)) if model_prediction == "Deepfake" else (model_confidence * 100)
    
    return jsonify({
        "prediction": model_prediction,
        "confidence": model_confidence,
        "authenticity_score": authenticity_score,
        "breakdown": {
            "metadata": random.randint(50, 99),
            "noise": random.randint(20, 80),
            "compression": random.randint(80, 99)
        }
    })

@app.route("/predict-video", methods=["POST"])
def predict_video():
    if "video" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["video"]
    upload_folder = "uploads"
    os.makedirs(upload_folder, exist_ok=True)
    video_path = os.path.join(upload_folder, file.filename)
    file.save(video_path)
    
    frames = extract_video_frames(video_path)
    if not frames:
        return jsonify({"error": "No valid frames extracted"}), 400
    
    inputs = video_processor(images=frames, return_tensors="pt")
    inputs = {k: v.to(video_model.device) for k, v in inputs.items()}
    
    video_model.eval()
    with torch.no_grad():
        outputs = video_model(**inputs)
    
    probs = F.softmax(outputs.logits, dim=1)
    return jsonify({
        "result": "Fake" if probs[0, 1].item() > 0.5 else "Real",
        "confidence": max(probs[0].tolist()),
        "fake_probability": probs[0, 1].item(),
        "real_probability": probs[0, 0].item()
    })

if __name__ == "__main__":
    socketio.run(app, debug=True)