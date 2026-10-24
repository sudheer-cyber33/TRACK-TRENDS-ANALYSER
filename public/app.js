let countryChartInstance = null;
let featuresChartInstance = null;
let currentPlaylistData = null;
let recommendationPool = [];
let recommendationIndex = 0;
let toastFadeTimeout = null;

// Country -> States mapping for dynamic drill-down
const COUNTRY_STATES_MAP = {
    'India': [
        'Telangana',
        'All States (National)',
        'Andhra Pradesh',
        'Tamil Nadu',
        'Karnataka',
        'Maharashtra',
        'Punjab',
        'Kerala',
        'Delhi NCR',
        'West Bengal'
    ],
    'United States': [
        'All States (National)',
        'California',
        'Texas',
        'New York',
        'Florida',
        'Tennessee'
    ],
    'United Kingdom': [
        'All States (National)',
        'England',
        'Scotland',
        'Wales',
        'Northern Ireland'
    ],
    'Brazil': [
        'All States (National)',
        'São Paulo',
        'Rio de Janeiro',
        'Bahia',
        'Minas Gerais'
    ],
    'Germany': [
        'All States (National)',
        'Berlin',
        'Bavaria',
        'Hamburg',
        'North Rhine-Westphalia'
    ],
    'Canada': [
        'All States (National)',
        'Ontario',
        'Quebec',
        'British Columbia'
    ],
    'South Korea': [
        'All States (National)',
        'Seoul',
        'Busan',
        'Incheon'
    ],
    'Japan': [
        'All States (National)',
        'Tokyo',
        'Osaka',
        'Kyoto'
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize sidebar search
    fetchTracks('Taylor Swift');

    document.getElementById('searchBtn').addEventListener('click', () => {
        const query = document.getElementById('searchInput').value.trim();
        if (query) fetchTracks(query);
    });

    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = document.getElementById('searchInput').value.trim();
            if (query) fetchTracks(query);
        }
    });

    // 2. Initialize Regional Top 10 (Default: India -> Telangana -> All-Time)
    populateStates('India', 'Telangana');
    loadRegionalTopTen();

    // Quick Country Chip Buttons
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedCountry = btn.getAttribute('data-country');
            document.getElementById('countrySelect').value = selectedCountry;
            updateActiveCountryChip(selectedCountry);
            const defaultState = selectedCountry === 'India' ? 'Telangana' : 'All States (National)';
            populateStates(selectedCountry, defaultState);
            loadRegionalTopTen();
            initLocalityRecommendations(selectedCountry, defaultState);
        });
    });

    // Dropdown change events
    document.getElementById('countrySelect').addEventListener('change', (e) => {
        const country = e.target.value;
        updateActiveCountryChip(country);
        const defaultState = country === 'India' ? 'Telangana' : 'All States (National)';
        populateStates(country, defaultState);
        loadRegionalTopTen();
        initLocalityRecommendations(country, defaultState);
    });

    document.getElementById('stateSelect').addEventListener('change', () => {
        syncStatePills();
        loadRegionalTopTen();
    });

    document.getElementById('durationSelect').addEventListener('change', () => {
        loadRegionalTopTen();
    });

    document.getElementById('fetchTopTenBtn').addEventListener('click', () => {
        loadRegionalTopTen();
    });

    // 3. Initialize Smart Playlist Generator
    generateSmartPlaylist('Top 10 Telangana Telugu Hits');

    document.getElementById('generatePlaylistBtn').addEventListener('click', () => {
        const prompt = document.getElementById('playlistPromptInput').value.trim();
        if (prompt) generateSmartPlaylist(prompt);
    });

    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            document.getElementById('playlistPromptInput').value = prompt;
            generateSmartPlaylist(prompt);
        });
    });

    document.getElementById('exportPlaylistBtn').addEventListener('click', exportPlaylistToCSV);

    // 4. Initialize Auto-Fading Locality Recommendation Popup (5s display, every 60s)
    initLocalityRecommendations('India', 'Telangana');

    document.getElementById('closeToastBtn').addEventListener('click', hideRecommendationToast);
    document.getElementById('testPopupBtn').addEventListener('click', () => {
        showNextRecommendationToast();
    });
});

function updateActiveCountryChip(country) {
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-country') === country);
    });
}

function populateStates(country, selectedState) {
    const states = COUNTRY_STATES_MAP[country] || ['All States (National)'];
    const stateSelect = document.getElementById('stateSelect');
    const pillsContainer = document.getElementById('statePillsContainer');

    stateSelect.innerHTML = '';
    pillsContainer.innerHTML = `<span class="bar-label">States in ${country}:</span>`;

    states.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        if (st === selectedState) opt.selected = true;
        stateSelect.appendChild(opt);

        const pill = document.createElement('button');
        pill.className = `state-pill ${st === selectedState ? 'active' : ''}`;
        pill.textContent = st;
        pill.addEventListener('click', () => {
            stateSelect.value = st;
            syncStatePills();
            loadRegionalTopTen();
            initLocalityRecommendations(country, st);
        });
        pillsContainer.appendChild(pill);
    });
}

function syncStatePills() {
    const currentVal = document.getElementById('stateSelect').value;
    document.querySelectorAll('.state-pill').forEach(pill => {
        pill.classList.toggle('active', pill.textContent === currentVal);
    });
}

// Fetch sidebar live tracks
async function fetchTracks(query) {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const tracks = await response.json();

        const trackListEl = document.getElementById('trackList');
        trackListEl.innerHTML = '';

        if (!Array.isArray(tracks) || tracks.length === 0) {
            trackListEl.innerHTML = '<p style="color:#888;">No tracks found.</p>';
            return;
        }

        tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = `track-item ${index === 0 ? 'active' : ''}`;
            item.innerHTML = `
                <img src="${track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || ''}" alt="cover">
                <div class="track-info-mini">
                    <h4>${track.name}</h4>
                    <p>${track.artists.map(a => a.name).join(', ')}</p>
                </div>
            `;
            item.addEventListener('click', () => {
                document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                loadTrackStats(track.id);
            });
            trackListEl.appendChild(item);
        });

        loadTrackStats(tracks[0].id);
    } catch (err) {
        console.error('Failed to load track list:', err);
    }
}

// Fetch single track KPIs & Charts
async function loadTrackStats(trackId) {
    try {
        const res = await fetch(`/api/track-stats/${trackId}`);
        const data = await res.json();

        document.getElementById('trackCover').src = data.coverUrl;
        document.getElementById('trackTitle').textContent = data.name;
        document.getElementById('trackArtist').textContent = data.artist;
        document.getElementById('trackAlbum').textContent = `${data.album} (${data.releaseDate.slice(0, 4)})`;
        document.getElementById('trackPopularity').textContent = `Popularity Index: ${data.popularity}/100`;
        document.getElementById('trackRating').textContent = `★ ${data.ratingScore} / 5.0`;
        document.getElementById('trackMood').textContent = `Mood: ${data.moodTag}`;

        document.getElementById('kpiListeners').textContent = data.estimatedListeners.toLocaleString();
        document.getElementById('kpiLikes').textContent = data.estimatedLikes.toLocaleString();
        document.getElementById('kpiTempo').textContent = `${data.audioFeatures.tempo} BPM`;

        renderCountryChart(data.countryStats);
        renderFeaturesChart(data.audioFeatures);
    } catch (err) {
        console.error('Error loading track stats:', err);
    }
}

// Load Regional & State-Wise Top 10 Leaderboard
async function loadRegionalTopTen() {
    const country = document.getElementById('countrySelect').value;
    const state = document.getElementById('stateSelect').value;
    const duration = document.getElementById('durationSelect').value;

    const tbody = document.getElementById('topTenTableBody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#888;">Extracting & ranking Top 10 songs for ${state}, ${country}...</td></tr>`;

    try {
        const res = await fetch(`/api/top-ten?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}&duration=${encodeURIComponent(duration)}`);
        const data = await res.json();

        document.getElementById('summaryRegionTitle').textContent = `${data.state}, ${data.country} (${data.duration})`;
        document.getElementById('summaryRegionalListeners').textContent = data.totalRegionalListeners.toLocaleString();
        document.getElementById('summaryTopSong').textContent = data.topTrack ? `${data.topTrack.name} — ${data.topTrack.artist}` : 'N/A';

        tbody.innerHTML = '';

        data.tracks.forEach(track => {
            const tr = document.createElement('tr');
            const rankClass = track.rank <= 3 ? `rank-${track.rank}` : '';

            tr.innerHTML = `
                <td><span class="rank-badge ${rankClass}">#${track.rank}</span></td>
                <td>
                    <div class="table-track-cell">
                        <img src="${track.coverThumb}" alt="${track.name}">
                        <div>
                            <strong>${track.name}</strong>
                            <span>${track.artist}</span>
                        </div>
                    </div>
                </td>
                <td>${track.releaseDate.slice(0, 4)}</td>
                <td><strong>${track.regionalListeners.toLocaleString()}</strong></td>
                <td><span class="star-rating">★ ${track.ratingScore}</span> <span style="color:#888;">(${track.popularity}/100)</span></td>
                <td>${track.moodTag}</td>
                <td>
                    <button class="table-btn inspect-btn" data-id="${track.id}">Inspect</button>
                    <a href="${track.spotifyUrl}" target="_blank" class="table-btn" style="text-decoration:none;">Spotify ↗</a>
                </td>
            `;

            tr.querySelector('.inspect-btn').addEventListener('click', () => {
                loadTrackStats(track.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading regional top 10:', err);
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ff5555;">Failed to load regional Top 10 data.</td></tr>`;
    }
}

// Generate Automated Top 10 Playlist
async function generateSmartPlaylist(prompt) {
    const grid = document.getElementById('generatedPlaylistGrid');
    grid.innerHTML = '<p style="color:#888;grid-column:span 2;">Curating Top 10 Playlist from Spotify data...</p>';

    try {
        const res = await fetch(`/api/generate-playlist?prompt=${encodeURIComponent(prompt)}`);
        const data = await res.json();
        currentPlaylistData = data;

        document.getElementById('plTitle').textContent = data.playlistName;
        document.getElementById('plListeners').textContent = data.totalListeners.toLocaleString();
        document.getElementById('plRatingTempo').textContent = `★ ${data.avgRating} | ${data.avgTempo} BPM`;
        document.getElementById('plMood').textContent = data.dominantMood;

        grid.innerHTML = '';

        data.tracks.forEach(track => {
            const card = document.createElement('div');
            card.className = 'playlist-card-item';
            card.innerHTML = `
                <div class="playlist-card-left">
                    <span class="playlist-pos">#${track.position}</span>
                    <img src="${track.coverThumb}" alt="${track.name}">
                    <div>
                        <h4 style="font-size:14px;">${track.name}</h4>
                        <p style="font-size:12px;color:#b3b3b3;">${track.artist}</p>
                        <span style="font-size:11px;color:#1DB954;">★ ${track.ratingScore} • ${track.estimatedListeners.toLocaleString()} listeners</span>
                    </div>
                </div>
                <div>
                    <button class="table-btn pl-inspect-btn" data-id="${track.id}">Stats</button>
                    <a href="${track.spotifyUrl}" target="_blank" class="table-btn" style="text-decoration:none;">Play ↗</a>
                </div>
            `;

            card.querySelector('.pl-inspect-btn').addEventListener('click', () => {
                loadTrackStats(track.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Error generating playlist:', err);
        grid.innerHTML = '<p style="color:#ff5555;">Failed to generate playlist.</p>';
    }
}

// Export Generated Playlist to CSV
function exportPlaylistToCSV() {
    if (!currentPlaylistData || !currentPlaylistData.tracks) return;

    const headers = ['Rank', 'Track Name', 'Artist', 'Album', 'Release Year', 'Rating', 'Popularity', 'Estimated Listeners', 'Tempo BPM', 'Mood', 'Spotify URL'];
    const rows = currentPlaylistData.tracks.map(t => [
        t.position,
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.artist.replace(/"/g, '""')}"`,
        `"${t.album.replace(/"/g, '""')}"`,
        t.releaseDate.slice(0, 4),
        t.ratingScore,
        t.popularity,
        t.estimatedListeners,
        t.tempo,
        `"${t.moodTag}"`,
        t.spotifyUrl
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentPlaylistData.playlistName.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Locality & State Recommendation Popup Engine (5 seconds display, repeats every 60 seconds)
let recommendationIntervalId = null;

async function initLocalityRecommendations(country = 'India', state = 'Telangana') {
    try {
        const res = await fetch(`/api/recommendations?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`);
        const data = await res.json();

        recommendationPool = data.recommendations || [];
        recommendationIndex = 0;

        if (recommendationPool.length > 0) {
            // Show initial popup immediately when application loads
            setTimeout(() => {
                showNextRecommendationToast(data.locality);
            }, 1200);

            // Clear old interval and set exact 1-minute (60,000 ms) cycle
            if (recommendationIntervalId) clearInterval(recommendationIntervalId);
            recommendationIntervalId = setInterval(() => {
                showNextRecommendationToast(data.locality);
            }, 60000);
        }
    } catch (err) {
        console.error('Error initializing locality recommendations:', err);
    }
}

function showNextRecommendationToast(localityText) {
    if (!recommendationPool.length) return;

    const track = recommendationPool[recommendationIndex % recommendationPool.length];
    recommendationIndex++;

    const country = document.getElementById('countrySelect').value;
    const state = document.getElementById('stateSelect').value;
    const activeLocality = localityText || `${state}, ${country}`;

    document.getElementById('toastCover').src = track.coverUrl || track.coverThumb;
    document.getElementById('toastLocalityLabel').textContent = `Most listened recently in ${activeLocality}`;
    document.getElementById('toastSongTitle').textContent = track.name;
    document.getElementById('toastSongArtist').textContent = track.artist;
    document.getElementById('toastListeners').textContent = `👥 ${track.regionalListeners.toLocaleString()} local listeners`;
    document.getElementById('toastRating').textContent = `★ ${track.ratingScore} (${track.moodTag})`;

    const inspectBtn = document.getElementById('toastInspectBtn');
    inspectBtn.onclick = () => {
        loadTrackStats(track.id);
        hideRecommendationToast();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toastEl = document.getElementById('recommendationToast');
    const progressFill = document.getElementById('toastProgressFill');

    // Reset progress bar animation for 5-second countdown
    progressFill.style.transition = 'none';
    progressFill.style.width = '100%';
    toastEl.classList.remove('hidden');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            progressFill.style.transition = 'width 5s linear';
            progressFill.style.width = '0%';
        });
    });

    if (toastFadeTimeout) clearTimeout(toastFadeTimeout);

    // Close and fade out automatically after 5 seconds (5000 ms)
    toastFadeTimeout = setTimeout(() => {
        hideRecommendationToast();
    }, 5000);
}

function hideRecommendationToast() {
    const toastEl = document.getElementById('recommendationToast');
    toastEl.classList.add('hidden');
    if (toastFadeTimeout) clearTimeout(toastFadeTimeout);
}

// Render Country Bar Chart
function renderCountryChart(countryData) {
    const ctx = document.getElementById('countryChart').getContext('2d');
    if (countryChartInstance) countryChartInstance.destroy();

    countryChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countryData.map(c => c.country),
            datasets: [{
                label: 'Listeners',
                data: countryData.map(c => c.listeners),
                backgroundColor: '#1DB954',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { color: '#B3B3B3' }, grid: { color: '#282828' } },
                x: { ticks: { color: '#B3B3B3' }, grid: { display: false } }
            }
        }
    });
}

// Render Audio Features Radar Chart
function renderFeaturesChart(features) {
    const ctx = document.getElementById('featuresChart').getContext('2d');
    if (featuresChartInstance) featuresChartInstance.destroy();

    featuresChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Danceability', 'Energy', 'Valence (Mood)', 'Acousticness'],
            datasets: [{
                label: 'Audio Feature Rating',
                data: [
                    Math.round(features.danceability * 100),
                    Math.round(features.energy * 100),
                    Math.round(features.valence * 100),
                    Math.round(features.acousticness * 100)
                ],
                backgroundColor: 'rgba(29, 185, 84, 0.22)',
                borderColor: '#1DB954',
                pointBackgroundColor: '#1DB954'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: '#282828' },
                    grid: { color: '#282828' },
                    pointLabels: { color: '#FFFFFF' },
                    ticks: { display: false, max: 100, min: 0 }
                }
            }
        }
    });
}