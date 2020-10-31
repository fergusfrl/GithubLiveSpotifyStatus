const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const qs = require('qs');
const { GitHubProfileStatus } = require('github-profile-status');
const { firestore } = require('firebase-admin');

admin.initializeApp();

const getSpotifyAuthToken = functions
  .pubsub
  .schedule('*/15 7-23 * * *')
  .onRun(() => {
    const currentTime = firestore.Timestamp.now().toDate().toLocaleTimeString('NZST', {
      hour12: false, hour: '2-digit'
    });

    if (currentTime > 22) {
      axios({
        method: 'POST',
        url: 'https://us-central1-test-database-200da.cloudfunctions.net/setGithubProfileStatus',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          emoji: ':sleeping:',
          message: 'Goodnight from NZ!',
        })
      });
      return { success: true };
    }

    const data = qs.stringify({
      'grant_type': 'refresh_token',
      'refresh_token': functions.config().spotify.refresh_token
    });

    axios({
      method: 'POST',
      url: 'https://accounts.spotify.com/api/token',
      headers: { 
        'Authorization': `Basic ${functions.config().spotify.base64_creds}`, 
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: data,
    })
    .then(res => {
      axios({
        method: 'POST',
        url: 'https://us-central1-test-database-200da.cloudfunctions.net/getSpotifyCurrentlyPlaying',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({ access_token: res.data.access_token })
      });
      return { success: true }
    })
    .catch(err => {
      console.error('Something went wrong:', err);
      return { success: false }
    });
    return {};
  });

const getSpotifyCurrentlyPlaying = functions.https.onRequest((request, response) => {
  const { access_token } = request.body;
  axios({
    method: 'GET',
    url: 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    }
  })
  .then(res => {
    const isCurrentlyPlaying = res.data.item;
    let statusUpdate = {
      emoji: ':yellow_heart:',
      message: '',
    };
    if (isCurrentlyPlaying) {
      statusUpdate = {
        emoji: ':headphones:',
        message: `Currently listening to ${res.data.item.name} on Spotify`,
      };
    }

    // TODO: possible other updates in the future.

    axios({
      method: 'POST',
      url: 'https://us-central1-test-database-200da.cloudfunctions.net/setGithubProfileStatus',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(statusUpdate)
    });
    response.send(200);
    return
  })
  .catch(err => {
    console.error('Something went wrong:', err);
    response.send(500);
    return;
  })
});

const setGithubProfileStatus = functions.https.onRequest((req, res) => {
  const { emoji, message } = req.body;
  const profileStatus = new GitHubProfileStatus({
    token: functions.config().github.user_access_token,
  });

  profileStatus.set({
    emoji,
    message
  })
  .then(() => res.send(200))
  .catch(() => res.send(500));
});

module.exports = {
  onAdventureStart,
  onAdventureStop,
  handleAlert,
  getSpotifyAuthToken,
  getSpotifyCurrentlyPlaying,
  setGithubProfileStatus,
};
