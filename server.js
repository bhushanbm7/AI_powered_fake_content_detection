let confidenceData = {
  image: { score: 0, prediction: '' },
  video: { score: 0, prediction: '', fakeProb: 0, realProb: 0 },
  text: { fakeProb: 0, realProb: 0 }
};

let uploadedImageFile = null;
let uploadedVideoFile = null;

// Initialize Dark Mode and Application
document.addEventListener('DOMContentLoaded', function() {
  // Dark Mode Toggle Functionality
  const darkModeToggle = document.getElementById('darkModeToggle');
  
  // Check for saved user preference
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.documentElement.setAttribute('data-theme', 'dark');
    darkModeToggle.checked = true;
  }
  
  // Toggle dark mode
  darkModeToggle.addEventListener('change', function() {
    if (this.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('darkMode', 'enabled');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('darkMode', 'disabled');
    }
  });

  // Initialize application
  setActiveTab('image');
  
  // Close modals when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target.className === 'modal') {
      event.target.style.display = 'none';
    }
  });

  // Set up drag and drop for image
  const dropZoneImage = document.getElementById('dropZone');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZoneImage.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZoneImage.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZoneImage.addEventListener(eventName, unhighlight, false);
  });

  dropZoneImage.addEventListener('drop', handleDropImage, false);

  // Set up drag and drop for video
  const dropZoneVideo = document.getElementById('dropZoneVideo');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZoneVideo.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZoneVideo.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZoneVideo.addEventListener(eventName, unhighlight, false);
  });

  dropZoneVideo.addEventListener('drop', handleDropVideo, false);

  // Initialize feedback functionality
  setupRatingStars();
  setupFeedbackForm();
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  e.currentTarget.classList.add('highlight');
}

function unhighlight(e) {
  e.currentTarget.classList.remove('highlight');
}

function handleDropImage(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    uploadedImageFile = files[0];
    document.getElementById('fileUploadImage').files = files;
    document.getElementById('scanImageBtn').style.display = 'block';
    updateDropZoneText('dropZone', files[0].name);
  }
}

function handleDropVideo(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0 && files[0].type.startsWith('video/')) {
    uploadedVideoFile = files[0];
    document.getElementById('fileUploadVideo').files = files;
    document.getElementById('scanVideoBtn').style.display = 'block';
    updateDropZoneText('dropZoneVideo', files[0].name);
  }
}

function updateDropZoneText(dropZoneId, fileName) {
  const dropZone = document.getElementById(dropZoneId);
  dropZone.innerHTML = `
    <p><strong>Selected File:</strong></p>
    <p>${fileName}</p>
    <button class="browse-button" onclick="triggerFileInput('${dropZoneId === 'dropZone' ? 'image' : 'video'}')">
      <span class="button-icon">🔄</span> Change File
    </button>
  `;
}

// Tab Management
function setActiveTab(tab) {
  // Reset all tabs
  document.querySelectorAll('.navbar-link').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.content-type button').forEach(el => el.classList.remove('active'));
  
  // Hide all sections
  document.getElementById('imageUploadSection').style.display = 'none';
  document.getElementById('textUploadSection').style.display = 'none';
  document.getElementById('videoUploadSection').style.display = 'none';
  document.getElementById('result').innerHTML = '';
  document.getElementById('imageAnalysisContainer').style.display = 'none';
  document.getElementById('videoAnalysisContainer').style.display = 'none';
  document.querySelectorAll('.graph-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.show-graph-button').forEach(el => el.style.display = 'none');
  
  // Activate selected tab
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`btn-${tab}`).classList.add('active');
  document.getElementById(`${tab}UploadSection`).style.display = 'block';
}

// File Handling
function triggerFileInput(type) {
  document.getElementById(`fileUpload${type.charAt(0).toUpperCase() + type.slice(1)}`).click();
}

document.getElementById('fileUploadImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadedImageFile = file;
    document.getElementById('scanImageBtn').style.display = 'block';
    updateDropZoneText('dropZone', file.name);
  }
});

document.getElementById('fileUploadVideo').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadedVideoFile = file;
    document.getElementById('scanVideoBtn').style.display = 'block';
    updateDropZoneText('dropZoneVideo', file.name);
  }
});

// Image Analysis
async function scanImage() {
  if (!uploadedImageFile) {
    alert("Please upload an image file first.");
    return;
  }
  
  const formData = new FormData();
  formData.append("file", uploadedImageFile);
  
  try {
    const response = await fetch("http://127.0.0.1:5000/predict-image", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    
    confidenceData.image = {
      score: data.authenticity_score,
      prediction: data.prediction,
      confidence: data.confidence * 100,
      breakdown: data.breakdown
    };
    
    const imageURL = URL.createObjectURL(uploadedImageFile);
    
    const resultHTML = `
      <h3>Image Analysis Results</h3>
      <p><strong>File Name:</strong> ${uploadedImageFile.name}</p>
      <p><strong>Prediction:</strong> <span class="prediction-${data.prediction.toLowerCase()}">${data.prediction}</span></p>
      <p><strong>Authenticity Score:</strong> ${data.authenticity_score.toFixed(2)}%</p>
      <p><strong>Model Confidence:</strong> ${(data.confidence * 100).toFixed(2)}%</p>
    `;
    
    const analysisHTML = `
      <div class="analysis-grid">
        <div class="analysis-preview">
          <h4>Image Preview</h4>
          <img src="${imageURL}" alt="Uploaded Image" class="analyzed-image">
        </div>
        <div class="analysis-details">
          <h4>Forensic Analysis</h4>
          <div class="analysis-metric">
            <label>Metadata Analysis</label>
            <div class="metric-bar">
              <div class="metric-fill" style="width: ${data.breakdown.metadata}%;"></div>
              <span>${data.breakdown.metadata}%</span>
            </div>
          </div>
          <div class="analysis-metric">
            <label>Noise Analysis</label>
            <div class="metric-bar">
              <div class="metric-fill" style="width: ${data.breakdown.noise}%;"></div>
              <span>${data.breakdown.noise}%</span>
            </div>
          </div>
          <div class="analysis-metric">
            <label>Compression Analysis</label>
            <div class="metric-bar">
              <div class="metric-fill" style="width: ${data.breakdown.compression}%;"></div>
              <span>${data.breakdown.compression}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('result').innerHTML = resultHTML;
    document.getElementById('imageAnalysisContainer').innerHTML = analysisHTML;
    document.getElementById('imageAnalysisContainer').style.display = 'block';
    document.getElementById('showImageGraphBtn').style.display = 'block';
    
  } catch (error) {
    document.getElementById('result').innerHTML = `
      <p class="error">Error processing image. Please try again.</p>
    `;
  }
}

// Video Analysis
const socket = io();

socket.on('progress', function(data) {
  document.getElementById('videoProgress').style.display = 'block';
  document.getElementById('videoProgressText').innerText = `${data.progress}%`;
  document.getElementById('videoProgressBar').style.width = `${data.progress}%`;
});

async function scanVideo() {
  if (!uploadedVideoFile) {
    alert("Please upload a video file first.");
    return;
  }
  
  const formData = new FormData();
  formData.append("video", uploadedVideoFile);
  
  try {
    document.getElementById('videoProgress').style.display = 'block';
    
    const response = await fetch("http://127.0.0.1:5000/predict-video", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    
    confidenceData.video = {
      score: data.confidence * 100,
      prediction: data.result,
      fakeProb: data.fake_probability * 100,
      realProb: data.real_probability * 100
    };
    
    const resultHTML = `
      <h3>Video Analysis Results</h3>
      <p><strong>File Name:</strong> ${uploadedVideoFile.name}</p>
      <p><strong>Prediction:</strong> <span class="prediction-${data.result.toLowerCase()}">${data.result}</span></p>
      <p><strong>Confidence:</strong> ${(data.confidence * 100).toFixed(2)}%</p>
      
      <div class="probability-meters">
        <div class="probability-meter">
          <label>Real Probability</label>
          <div class="meter-container">
            <div class="meter-fill real" style="width: ${data.real_probability * 100}%;"></div>
            <span>${(data.real_probability * 100).toFixed(2)}%</span>
          </div>
        </div>
        <div class="probability-meter">
          <label>Fake Probability</label>
          <div class="meter-container">
            <div class="meter-fill fake" style="width: ${data.fake_probability * 100}%;"></div>
            <span>${(data.fake_probability * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('result').innerHTML = resultHTML;
    document.getElementById('showVideoGraphBtn').style.display = 'block';
    
  } catch (error) {
    document.getElementById('result').innerHTML = `
      <p class="error">Error processing video. Please try again.</p>
    `;
  } finally {
    document.getElementById('videoProgress').style.display = 'none';
  }
}

// Text Analysis
async function checkFakeNews() {
  const text = document.getElementById('newsText').value.trim();
  if (!text) {
    alert("Please enter some text to analyze.");
    return;
  }
  
  try {
    const response = await fetch("http://127.0.0.1:5000/predict-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });
    const result = await response.json();
    
    confidenceData.text = {
      fakeProb: result.probability.Fake * 100,
      realProb: result.probability.Real * 100
    };
    
    const resultHTML = `
      <h3>Text Analysis Results</h3>
      <p><strong>Prediction:</strong> <span class="prediction-${result.prediction.toLowerCase()}">${result.prediction}</span></p>
      
      <div class="probability-meters">
        <div class="probability-meter">
          <label>Real Probability</label>
          <div class="meter-container">
            <div class="meter-fill real" style="width: ${result.probability.Real * 100}%;"></div>
            <span>${(result.probability.Real * 100).toFixed(2)}%</span>
          </div>
        </div>
        <div class="probability-meter">
          <label>Fake Probability</label>
          <div class="meter-container">
            <div class="meter-fill fake" style="width: ${result.probability.Fake * 100}%;"></div>
            <span>${(result.probability.Fake * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('result').innerHTML = resultHTML;
    document.getElementById('showTextGraphBtn').style.display = 'block';
    
  } catch (error) {
    alert("Error occurred while analyzing text. Please try again.");
  }
}

function clearText() {
  document.getElementById('newsText').value = '';
  document.getElementById('result').innerHTML = '';
}

// Graph Functions
function showGraph(type) {
  const sectionId = `${type}GraphSection`;
  document.getElementById(sectionId).style.display = 'block';
  
  const ctx = document.getElementById(`${type}ConfidenceChart`).getContext('2d');
  let chartData;
  
  if (type === 'image') {
    chartData = {
      labels: ['Authenticity Score', 'Remaining'],
      datasets: [{
        data: [confidenceData.image.score, 100 - confidenceData.image.score],
        backgroundColor: ['#28a745', '#e9ecef'],
        borderWidth: 1
      }]
    };
  } else if (type === 'video') {
    chartData = {
      labels: ['Real', 'Fake'],
      datasets: [{
        data: [confidenceData.video.realProb, confidenceData.video.fakeProb],
        backgroundColor: ['#28a745', '#dc3545'],
        borderWidth: 1
      }]
    };
  } else if (type === 'text') {
    chartData = {
      labels: ['Real', 'Fake'],
      datasets: [{
        data: [confidenceData.text.realProb, confidenceData.text.fakeProb],
        backgroundColor: ['#28a745', '#dc3545'],
        borderWidth: 1
      }]
    };
  }
  
  new Chart(ctx, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: `${type.charAt(0).toUpperCase() + type.slice(1)} Analysis Results`,
          font: { size: 16 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw.toFixed(2)}%`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function closeGraph(sectionId) {
  document.getElementById(sectionId).style.display = 'none';
}

// Modal Functions
function showAboutUs() {
  document.getElementById('aboutModal').style.display = 'flex';
}

function showHelp() {
  document.getElementById('helpModal').style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Scroll to Top
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.onscroll = function() {
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    backToTopBtn.style.display = 'flex';
  } else {
    backToTopBtn.style.display = 'none';
  }
};

// Feedback Functions
function showFeedbackModal() {
  document.getElementById('feedbackModal').style.display = 'flex';
}

// Initialize star rating
function setupRatingStars() {
  const stars = document.querySelectorAll('.rating-stars i');
  const ratingInput = document.getElementById('feedbackRating');
  
  stars.forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.getAttribute('data-rating'));
      ratingInput.value = rating;
      
      // Update star display
      stars.forEach((s, index) => {
        if (index < rating) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
    
    star.addEventListener('mouseover', function() {
      const hoverRating = parseInt(this.getAttribute('data-rating'));
      
      stars.forEach((s, index) => {
        if (index < hoverRating) {
          s.classList.add('hover');
        } else {
          s.classList.remove('hover');
        }
      });
    });
    
    star.addEventListener('mouseout', function() {
      stars.forEach(s => s.classList.remove('hover'));
    });
  });
}

// Handle feedback form submission
function setupFeedbackForm() {
  const form = document.getElementById('feedbackForm');
  
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('feedbackName').value;
    const email = document.getElementById('feedbackEmail').value;
    const rating = document.getElementById('feedbackRating').value;
    const message = document.getElementById('feedbackMessage').value;
    
    if (!message) {
      alert('Please enter your feedback message');
      return;
    }
    
    // Here you would typically send the feedback to your server
    // For now, we'll just log it and show a thank you message
    console.log('Feedback submitted:', { name, email, rating, message });
    
    alert('Thank you for your feedback!');
    closeModal('feedbackModal');
    form.reset();
    
    // Reset stars
    document.querySelectorAll('.rating-stars i').forEach(star => {
      star.classList.remove('active');
    });
    document.getElementById('feedbackRating').value = '0';
  });
}