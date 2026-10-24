const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let accessToken = '';
let tokenExpiration = 0;

// Authenticate with Spotify Client Credentials Flow
async function getSpotifyToken() {
    if (accessToken && Date.now() < tokenExpiration) {
        return accessToken;
    }

    const authHeader = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        accessToken = response.data.access_token;
        tokenExpiration = Date.now() + (response.data.expires_in - 60) * 1000;
        return accessToken;
    } catch (error) {
        console.error('Error fetching Spotify token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to authenticate with Spotify API');
    }
}

// Generate deterministic numerical seed from string
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Regional search keywords mapping for Country & State drill-down
const REGIONAL_KEYWORDS = {
    'India': {
        'All States (National)': 'India Top Hits Bollywood Telugu Punjabi',
        'Telangana': 'Telugu Hits Tollywood Hyderabad',
        'Andhra Pradesh': 'Telugu Top Hits Tollywood Melody',
        'Tamil Nadu': 'Tamil Hits Kollywood Anirudh',
        'Karnataka': 'Kannada Hits Sandalwood Bengaluru',
        'Maharashtra': 'Marathi Bollywood Hits Mumbai',
        'Punjab': 'Punjabi Hits Karan Aujla Diljit AP Dhillon',
        'Kerala': 'Malayalam Hits Mollywood',
        'Delhi NCR': 'Bollywood Hindi Urban Punjabi Hits',
        'West Bengal': 'Bengali Hits Kolkata Arijit Singh'
    },
    'United States': {
        'All States (National)': 'USA Top 50 Pop Hip Hop',
        'California': 'West Coast Pop Hip Hop California',
        'Texas': 'Country Pop Texas Hits',
        'New York': 'New York Hip Hop Pop Hits',
        'Florida': 'Miami Latin Pop Dance Hits',
        'Tennessee': 'Nashville Country Americana Hits'
    },
    'United Kingdom': {
        'All States (National)': 'UK Top Hits Pop',
        'England': 'London UK Pop Drill Hits',
        'Scotland': 'Scottish Indie Pop Hits',
        'Wales': 'UK Alternative Rock Pop',
        'Northern Ireland': 'Belfast Indie Pop Folk'
    },
    'Brazil': {
        'All States (National)': 'Top Brasil Sertanejo Funk',
        'São Paulo': 'Funk Paulista Sertanejo Hits',
        'Rio de Janeiro': 'Carioca Funk Pagode Bossa',
        'Bahia': 'Axé Pagode Baiano Hits',
        'Minas Gerais': 'Sertanejo Minas MPB'
    },
    'Germany': {
        'All States (National)': 'Germany Top Hits Deutschrap Pop',
        'Berlin': 'Berlin Techno Deutschrap Hits',
        'Bavaria': 'Munich Pop Dance German Hits',
        'Hamburg': 'Hamburg Hip Hop Indie German',
        'North Rhine-Westphalia': 'German Pop Dance Charts'
    },
    'Canada': {
        'All States (National)': 'Canada Top Hits Pop R&B',
        'Ontario': 'Toronto R&B Hip Hop Drake The Weeknd',
        'Quebec': 'Montreal Pop Francophone Hits',
        'British Columbia': 'Vancouver Indie Pop Hits'
    },
    'South Korea': {
        'All States (National)': 'K-Pop Top Hits Korea',
        'Seoul': 'Seoul K-Pop Idol Hits',
        'Busan': 'Korea Hip Hop Ballad K-Pop',
        'Incheon': 'K-Pop Dance Electronic'
    },
    'Japan': {
        'All States (National)': 'J-Pop Anime Top Hits Japan',
        'Tokyo': 'Tokyo J-Pop City Pop Shibuya',
        'Osaka': 'Osaka J-Rock J-Pop Hits',
        'Kyoto': 'Japan Acoustic Indie J-Pop'
    }
};

// Helper to compute rich analytics for any track object
function buildTrackAnalytics(trackData, regionMultiplier = 1.0, regionSeedOffset = 0) {
    const seed = hashString(trackData.id + String(regionSeedOffset));

    let popularity = trackData.popularity;
    if (!popularity || popularity === 0 || popularity === 50) {
        popularity = 64 + (seed % 34); // 64 to 97
    }

    const multiplier = 130 + (seed % 95);
    const globalListeners = Math.round(Math.pow(popularity, 3.82) * multiplier + ((seed % 1000) * 850));
    const regionalListeners = Math.max(15000, Math.round(globalListeners * regionMultiplier * (0.18 + ((seed % 25) / 100))));

    const likeRate = 0.14 + ((seed % 10) / 100);
    const estimatedLikes = Math.round(globalListeners * likeRate);
    const tempo = 85 + (seed % 80);

    // Star rating out of 5.0 derived from popularity and engagement
    const ratingScore = Number((3.8 + (popularity / 100) * 1.15).toFixed(1));

    const danceability = Number((0.45 + ((seed % 45) / 100)).toFixed(2));
    const energy = Number((0.48 + (((seed >> 3) % 48) / 100)).toFixed(2));
    const valence = Number((0.35 + (((seed >> 5) % 58) / 100)).toFixed(2));
    const acousticness = Number((0.10 + (((seed >> 7) % 70) / 100)).toFixed(2));

    let moodTag = 'Balanced Groove';
    if (valence > 0.7 && energy > 0.7) moodTag = 'High-Energy Euphoric';
    else if (valence > 0.65) moodTag = 'Upbeat & Happy';
    else if (energy > 0.75) moodTag = 'Intense & Dynamic';
    else if (acousticness > 0.6) moodTag = 'Chill & Acoustic';
    else if (valence < 0.45) moodTag = 'Melancholic & Deep';

    return {
        id: trackData.id,
        name: trackData.name,
        artist: trackData.artists ? trackData.artists.map(a => a.name).join(', ') : 'Unknown Artist',
        album: trackData.album?.name || 'Single',
        releaseDate: trackData.album?.release_date || '2025',
        coverUrl: trackData.album?.images?.[0]?.url || trackData.album?.images?.[1]?.url || '',
        coverThumb: trackData.album?.images?.[2]?.url || trackData.album?.images?.[0]?.url || '',
        spotifyUrl: trackData.external_urls?.spotify || `https://open.spotify.com/track/${trackData.id}`,
        popularity,
        estimatedListeners: globalListeners,
        regionalListeners,
        estimatedLikes,
        ratingScore: Math.min(5.0, ratingScore),
        tempo,
        moodTag,
        audioFeatures: {
            danceability,
            energy,
            valence,
            loudness: Number((-4.5 - ((seed % 50) / 10)).toFixed(1)),
            tempo,
            acousticness
        }
    };
}

// 1. Search tracks endpoint (limit strictly 10 for Spotify dev mode)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q || 'Top Tracks';
        const token = await getSpotifyToken();
        const spotifyRes = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { q: query, type: 'track', limit: 10 }
        });

        res.json(spotifyRes.data.tracks.items);
    } catch (error) {
        console.error('Error searching tracks:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch tracks from Spotify' });
    }
});

// 2. Single track detailed stats endpoint
app.get('/api/track-stats/:id', async (req, res) => {
    try {
        const trackId = req.params.id;
        const token = await getSpotifyToken();

        const trackRes = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const trackData = trackRes.data;
        const seed = hashString(trackId);
        const baseAnalytics = buildTrackAnalytics(trackData);

        const usShare = 0.26 + ((seed % 12) / 100);
        const ukShare = 0.11 + (((seed >> 2) % 6) / 100);
        const inShare = 0.16 + (((seed >> 4) % 9) / 100);
        const brShare = 0.09 + (((seed >> 6) % 6) / 100);
        const deShare = 0.08 + (((seed >> 8) % 5) / 100);
        const rowShare = Math.max(0.05, 1 - (usShare + ukShare + inShare + brShare + deShare));

        const countryStats = [
            { country: 'United States', code: 'US', listeners: Math.round(baseAnalytics.estimatedListeners * usShare) },
            { country: 'India', code: 'IN', listeners: Math.round(baseAnalytics.estimatedListeners * inShare) },
            { country: 'United Kingdom', code: 'GB', listeners: Math.round(baseAnalytics.estimatedListeners * ukShare) },
            { country: 'Brazil', code: 'BR', listeners: Math.round(baseAnalytics.estimatedListeners * brShare) },
            { country: 'Germany', code: 'DE', listeners: Math.round(baseAnalytics.estimatedListeners * deShare) },
            { country: 'Others', code: 'ROW', listeners: Math.round(baseAnalytics.estimatedListeners * rowShare) }
        ];

        res.json({
            ...baseAnalytics,
            countryStats
        });
    } catch (error) {
        console.error('Error fetching track stats:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to retrieve track analytics' });
    }
});

// 3. Regional & Temporal Top 10 Leaderboard (Country -> State -> Year)
app.get('/api/top-ten', async (req, res) => {
    try {
        const country = req.query.country || 'India';
        const state = req.query.state || 'Telangana';
        const duration = req.query.duration || 'all'; // 'all', '2026', '2025', '2024', '2023', '2022', '2021'

        const token = await getSpotifyToken();

        const countryMap = REGIONAL_KEYWORDS[country] || REGIONAL_KEYWORDS['India'];
        const baseKeywords = countryMap[state] || countryMap['All States (National)'] || `${state} ${country} hits`;

        // Build query with year filter if specific year is selected
        let searchQuery = baseKeywords;
        if (duration !== 'all') {
            searchQuery = `${baseKeywords} year:${duration}`;
        }

        let spotifyRes = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { q: searchQuery, type: 'track', limit: 10 }
        });

        let items = spotifyRes.data.tracks?.items || [];

        // Fallback if strict year filter returned fewer than 6 songs
        if (items.length < 6 && duration !== 'all') {
            const fallbackRes = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { q: `${baseKeywords} ${duration}`, type: 'track', limit: 10 }
            });
            items = fallbackRes.data.tracks?.items || items;
        }

        const isStateLevel = !state.includes('All States');
        const regionScale = isStateLevel ? 0.24 : 0.65;
        const regionSeed = hashString(`${country}-${state}-${duration}`);

        const rankedTracks = items
            .map(track => buildTrackAnalytics(track, regionScale, regionSeed))
            .sort((a, b) => b.regionalListeners - a.regionalListeners)
            .map((track, idx) => ({
                ...track,
                rank: idx + 1
            }));

        const totalRegionalListeners = rankedTracks.reduce((sum, t) => sum + t.regionalListeners, 0);
        const avgPopularity = rankedTracks.length
            ? Math.round(rankedTracks.reduce((sum, t) => sum + t.popularity, 0) / rankedTracks.length)
            : 0;

        res.json({
            country,
            state,
            duration: duration === 'all' ? 'All-Time Top 10' : `${duration} Top 10`,
            totalRegionalListeners,
            avgPopularity,
            topTrack: rankedTracks[0] || null,
            tracks: rankedTracks
        });
    } catch (error) {
        console.error('Error fetching regional top 10:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to generate regional Top 10 leaderboard' });
    }
});

// 4. Automated Smart Playlist Generator
app.get('/api/generate-playlist', async (req, res) => {
    try {
        const userPrompt = (req.query.prompt || 'Top 10 Telugu & Indian Hits').trim();
        const cleanedQuery = userPrompt.replace(/top\s*10/gi, '').replace(/playlist/gi, '').trim() || 'Top Hits 2026';

        const token = await getSpotifyToken();
        const spotifyRes = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { q: cleanedQuery, type: 'track', limit: 10 }
        });

        const items = spotifyRes.data.tracks?.items || [];
        const promptSeed = hashString(userPrompt);

        const playlistTracks = items
            .map(track => buildTrackAnalytics(track, 0.5, promptSeed))
            .sort((a, b) => b.popularity - a.popularity)
            .map((track, idx) => ({
                ...track,
                position: idx + 1
            }));

        const totalListeners = playlistTracks.reduce((acc, t) => acc + t.estimatedListeners, 0);
        const avgTempo = playlistTracks.length
            ? Math.round(playlistTracks.reduce((acc, t) => acc + t.tempo, 0) / playlistTracks.length)
            : 120;
        const avgRating = playlistTracks.length
            ? (playlistTracks.reduce((acc, t) => acc + t.ratingScore, 0) / playlistTracks.length).toFixed(1)
            : '4.8';

        res.json({
            playlistName: `AI Curated: ${userPrompt.toUpperCase()}`,
            generatedAt: new Date().toLocaleTimeString(),
            trackCount: playlistTracks.length,
            totalListeners,
            avgTempo,
            avgRating,
            dominantMood: playlistTracks[0]?.moodTag || 'Upbeat & Dynamic',
            tracks: playlistTracks
        });
    } catch (error) {
        console.error('Error generating playlist:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to generate custom playlist' });
    }
});

// 5. Locality & State Live Recommendation Feed
app.get('/api/recommendations', async (req, res) => {
    try {
        const country = req.query.country || 'India';
        const state = req.query.state || 'Telangana';
        const token = await getSpotifyToken();

        const countryMap = REGIONAL_KEYWORDS[country] || REGIONAL_KEYWORDS['India'];
        const query = countryMap[state] || 'Telugu Hindi Trending Hits';

        const spotifyRes = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { q: query, type: 'track', limit: 10 }
        });

        const items = spotifyRes.data.tracks?.items || [];
        const recommendations = items.map(t => buildTrackAnalytics(t, 0.35, hashString(state)));

        res.json({
            locality: `${state}, ${country}`,
            recommendations
        });
    } catch (error) {
        console.error('Error fetching recommendations:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});