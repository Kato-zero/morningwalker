// Morning Walk Tracker PWA - Main Application
class WalkTracker {
    constructor() {
        this.isWalking = false;
        this.startTime = null;
        this.walkInterval = null;
        this.walkHistory = [];
        this.currentWalk = null;
        this.map = null;
        this.route = [];
        this.totalDistance = 0;
        this.steps = 0;
        this.watchId = null;
        
        // DOM Elements
        this.distanceEl = document.getElementById('distance');
        this.durationEl = document.getElementById('duration');
        this.stepsEl = document.getElementById('steps');
        this.startBtn = document.getElementById('startWalk');
        this.stopBtn = document.getElementById('stopWalk');
        this.gpsIndicator = document.getElementById('gpsIndicator');
        this.gpsText = document.getElementById('gpsText');
        this.emergencyBtn = document.getElementById('emergencyBtn');
        this.historySection = document.getElementById('historySection');
        this.backToTrackBtn = document.getElementById('backToTrack');
        
        this.initializeApp();
    }
    
    initializeApp() {
        // Load walk history from localStorage
        this.loadHistory();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize map
        this.initMap();
        
        // Request GPS permission
        this.requestGPSPermission();
        
        // Setup service worker for PWA
        this.registerServiceWorker();
        
        // Setup voice feedback
        this.setupVoiceFeedback();
        
        // Display today's history
        this.displayHistory('today');
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    console.log('New service worker found');
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    initMap() {
        // Initialize map with OpenStreetMap (free alternative)
        this.map = L.map('map').setView([0, 0], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(this.map);
        
        // Add attribution
        L.control.attribution({ position: 'bottomright' }).addTo(this.map);
    }
    
    requestGPSPermission() {
        if (!navigator.geolocation) {
            this.updateGPSStatus('GPS not supported', false);
            return;
        }
        
        // Test GPS
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.updateGPSStatus('GPS Active', true);
                this.centerMap(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                this.updateGPSStatus('GPS Error: ' + error.message, false);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }
    
    updateGPSStatus(message, isActive) {
        this.gpsText.textContent = message;
        this.gpsIndicator.className = isActive ? 'status-indicator active' : 'status-indicator';
    }
    
    centerMap(lat, lng) {
        if (this.map) {
            this.map.setView([lat, lng], 15);
            
            // Add user marker
            if (!this.userMarker) {
                this.userMarker = L.marker([lat, lng]).addTo(this.map);
            } else {
                this.userMarker.setLatLng([lat, lng]);
            }
        }
    }
    
    setupEventListeners() {
        // Start walk button
        this.startBtn.addEventListener('click', () => this.startWalk());
        
        // Stop walk button
        this.stopBtn.addEventListener('click', () => this.stopWalk());
        
        // Emergency button
        this.emergencyBtn.addEventListener('click', () => this.handleEmergency());
        
        // History tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchHistoryTab(tab);
            });
        });
        
        // Back to tracking button
        this.backToTrackBtn.addEventListener('click', () => {
            this.historySection.style.display = 'none';
        });
        
        // Show history when clicking on statistics
        document.querySelectorAll('.info-card').forEach(card => {
            card.addEventListener('click', () => {
                this.showHistory();
            });
        });
    }
    
    startWalk() {
        if (this.isWalking) return;
        
        this.isWalking = true;
        this.startTime = new Date();
        this.route = [];
        this.totalDistance = 0;
        this.steps = 0;
        
        // Update UI
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.startBtn.textContent = '🚶 Walking...';
        
        // Start tracking location
        this.startTracking();
        
        // Start timer
        this.startTimer();
        
        // Voice feedback
        this.speak("Walk started. Enjoy your walk!");
        
        // Show notification
        this.showNotification("Walk Started", "Your walk is now being tracked.");
    }
    
    startTracking() {
        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updatePosition(position),
            (error) => this.handleGPSError(error),
            options
        );
    }
    
    updatePosition(position) {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = new Date(position.timestamp);
        
        // Add to route
        const newPoint = { lat: latitude, lng: longitude, time: timestamp, accuracy };
        this.route.push(newPoint);
        
        // Update map
        this.updateMap();
        
        // Update distance
        if (this.route.length > 1) {
            const lastPoint = this.route[this.route.length - 2];
            const distance = this.calculateDistance(
                lastPoint.lat, lastPoint.lng,
                latitude, longitude
            );
            this.totalDistance += distance;
            
            // Estimate steps (average 0.0008 km per step)
            this.steps = Math.floor(this.totalDistance / 0.0008);
            
            // Update display
            this.distanceEl.textContent = `${this.totalDistance.toFixed(2)} km`;
            this.stepsEl.textContent = this.steps.toLocaleString();
        }
        
        // Center map on user
        this.centerMap(latitude, longitude);
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    updateMap() {
        if (this.route.length < 2) return;
        
        // Clear previous polyline
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
        }
        
        // Create new polyline
        const latLngs = this.route.map(point => [point.lat, point.lng]);
        this.routePolyline = L.polyline(latLngs, {
            color: '#4CAF50',
            weight: 5,
            opacity: 0.7,
            lineJoin: 'round'
        }).addTo(this.map);
    }
    
    startTimer() {
        this.walkInterval = setInterval(() => {
            const elapsed = new Date() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.durationEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopWalk() {
        if (!this.isWalking) return;
        
        this.isWalking = false;
        const endTime = new Date();
        
        // Stop tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Stop timer
        if (this.walkInterval) {
            clearInterval(this.walkInterval);
            this.walkInterval = null;
        }
        
        // Create walk record
        const walk = {
            id: Date.now(),
            startTime: this.startTime,
            endTime: endTime,
            duration: (endTime - this.startTime) / 1000, // seconds
            distance: this.totalDistance,
            steps: this.steps,
            route: this.route,
            date: new Date().toISOString().split('T')[0]
        };
        
        // Add to history
        this.walkHistory.unshift(walk);
        this.saveHistory();
        
        // Update UI
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.startBtn.textContent = '🚶 Start Walk';
        
        // Show summary
        this.showSummary(walk);
        
        // Voice feedback
        this.speak(`Walk completed. You walked ${this.totalDistance.toFixed(2)} kilometers in ${Math.floor(walk.duration / 60)} minutes.`);
        
        // Reset for next walk
        this.currentWalk = null;
        
        // Show history
        this.showHistory();
    }
    
    showSummary(walk) {
        const durationMinutes = Math.floor(walk.duration / 60);
        const durationSeconds = Math.floor(walk.duration % 60);
        
        alert(`🎉 Walk Completed!\n
📏 Distance: ${walk.distance.toFixed(2)} km
⏱️ Time: ${durationMinutes}m ${durationSeconds}s
👣 Steps: ${walk.steps.toLocaleString()}
🗺️ Route saved to history`);
    }
    
    showHistory() {
        this.historySection.style.display = 'block';
        this.displayHistory('today');
    }
    
    switchHistoryTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}History`).classList.add('active');
        
        // Display history for selected tab
        this.displayHistory(tab);
    }
    
    displayHistory(tab) {
        const containerId = `${tab}History`;
        const container = document.getElementById(containerId);
        
        let filteredWalks = [];
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        switch(tab) {
            case 'today':
                filteredWalks = this.walkHistory.filter(walk => walk.date === today);
                break;
            case 'yesterday':
                filteredWalks = this.walkHistory.filter(walk => walk.date === yesterday);
                break;
            case 'all':
                filteredWalks = this.walkHistory;
                break;
        }
        
        if (filteredWalks.length === 0) {
            container.innerHTML = `
                <div class="no-history">
                    <p>No walks recorded yet</p>
                    <p>Start your first walk today!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredWalks.map(walk => this.createWalkCard(walk)).join('');
    }
    
    createWalkCard(walk) {
        const startTime = new Date(walk.startTime);
        const durationMinutes = Math.floor(walk.duration / 60);
        const durationSeconds = Math.floor(walk.duration % 60);
        
        return `
            <div class="walk-card">
                <div class="walk-card-header">
                    <div class="walk-card-date">
                        ${startTime.toLocaleDateString()}
                    </div>
                    <div class="walk-card-time">
                        ${startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
                <div class="walk-card-stats">
                    <div class="walk-stat">
                        <div class="label">Distance</div>
                        <div class="value">${walk.distance.toFixed(2)} km</div>
                    </div>
                    <div class="walk-stat">
                        <div class="label">Time</div>
                        <div class="value">${durationMinutes}m</div>
                    </div>
                    <div class="walk-stat">
                        <div class="label">Steps</div>
                        <div class="value">${walk.steps.toLocaleString()}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    handleGPSError(error) {
        console.error('GPS Error:', error);
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                this.updateGPSStatus('GPS Permission Denied', false);
                break;
            case error.POSITION_UNAVAILABLE:
                this.updateGPSStatus('GPS Signal Lost', false);
                break;
            case error.TIMEOUT:
                this.updateGPSStatus('GPS Timeout', false);
                break;
            default:
                this.updateGPSStatus('GPS Error', false);
        }
    }
    
    handleEmergency() {
        const emergencyNumber = "911"; // Change to your emergency number
        
        if (confirm(`🆘 Call Emergency Contact?\n\nPhone: ${emergencyNumber}\n\nYour location will be shared.`)) {
            // Speak emergency message
            this.speak("Emergency! Calling for help.");
            
            // Try to call
            window.location.href = `tel:${emergencyNumber}`;
            
            // Share location via SMS (if available)
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    const { latitude, longitude } = position.coords;
                    const message = `Emergency! My location: https://maps.google.com/?q=${latitude},${longitude}`;
                    const smsUrl = `sms:${emergencyNumber}?body=${encodeURIComponent(message)}`;
                    window.location.href = smsUrl;
                });
            }
        }
    }
    
    setupVoiceFeedback() {
        // Check if speech synthesis is available
        if ('speechSynthesis' in window) {
            this.speechSynth = window.speechSynthesis;
        }
    }
    
    speak(text) {
        if (!this.speechSynth) return;
        
        // Cancel any ongoing speech
        this.speechSynth.cancel();
        
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Show voice feedback indicator
        const voiceFeedback = document.getElementById('voiceFeedback');
        voiceFeedback.style.display = 'block';
        voiceFeedback.textContent = `🔊 ${text}`;
        
        // Hide indicator when done
        utterance.onend = () => {
            setTimeout(() => {
                voiceFeedback.style.display = 'none';
            }, 1000);
        };
        
        // Speak
        this.speechSynth.speak(utterance);
    }
    
    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }
    
    saveHistory() {
        // Keep only last 100 walks to prevent storage issues
        if (this.walkHistory.length > 100) {
            this.walkHistory = this.walkHistory.slice(0, 100);
        }
        
        localStorage.setItem('walkHistory', JSON.stringify(this.walkHistory));
        
        // Update all history tabs
        ['today', 'yesterday', 'all'].forEach(tab => {
            this.displayHistory(tab);
        });
    }
    
    loadHistory() {
        const saved = localStorage.getItem('walkHistory');
        if (saved) {
            try {
                this.walkHistory = JSON.parse(saved);
                // Convert date strings back to Date objects
                this.walkHistory.forEach(walk => {
                    walk.startTime = new Date(walk.startTime);
                    walk.endTime = new Date(walk.endTime);
                });
            } catch (e) {
                console.error('Error loading history:', e);
                this.walkHistory = [];
            }
        }
    }
    
    getWeeklyStats() {
        const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
        const weeklyWalks = this.walkHistory.filter(walk => 
            new Date(walk.startTime) >= oneWeekAgo
        );
        
        const totalDistance = weeklyWalks.reduce((sum, walk) => sum + walk.distance, 0);
        const totalSteps = weeklyWalks.reduce((sum, walk) => sum + walk.steps, 0);
        
        return {
            walks: weeklyWalks.length,
            distance: totalDistance,
            steps: totalSteps,
            avgDistance: totalDistance / Math.max(weeklyWalks.length, 1)
        };
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Create and initialize the walk tracker
    window.walkTracker = new WalkTracker();
});

// Install PWA prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button (optional)
    setTimeout(() => {
        if (confirm('Install Morning Walk Tracker app for better experience?')) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                deferredPrompt = null;
            });
        }
    }, 5000);
});

// Service worker update handling
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}
