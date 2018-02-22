
function GetCharacterID() {
  return axios({
    method: 'get',
    url: 'https://esi.tech.ccp.is/verify/?token='+token
  })
  .then( (response) => {
    characterID = response.data['CharacterID'];
    reactiveData.characterName = response.data['CharacterName'];
    reactiveData.charLocationDisplay = '';
    reactiveData.notifierDisplay = '';
    reactiveData.topbarContainerAnimation = 'none';
    reactiveData.topbarContainerAnimationModifier = 'none';
    reactiveData.notifierData = 'Tracking... | ';
    reactiveData.characterPortrait = 'https://image.eveonline.com/Character/'+characterID+'_32.jpg';
  })
  .catch( (error) => {
    console.log(error);
    return localGet_Promise('radarRefreshToken')
    .then( (items) => {
      refreshToken = (typeof items['radarRefreshToken'] == 'undefined') ? null : items['radarRefreshToken'];
      if (refreshToken != null) {
        return AttemptRefreshToken(refreshToken)
        .then( () => {
          return GetCharacterID();
        });
      }
    })
  })
}

function FindCharacter() {
  return syncData()
  .then( () => {
    if (refreshToken == null && characterID != null) {
      SetLogoutStateTopbar();
    }
    else if (refreshToken == null && characterID == null) {
      throw 'tracking stopped';
    }
    else if (characterID != null) {
      reactiveData.signInText = 'Sign Out';
      reactiveData.signInOnClick = RevokeToken;
      reactiveData.signInLink = 'javascript:;';
    }
    if (!radarTrackingEnabled){
      if (reactiveData.trackingTriggerText == 'Stop Tracking') {
        radarTrackingTrigger();
      }
      throw 'tracking stopped';
    }
    else {
      if (reactiveData.trackingTriggerText == 'Start Tracking') {
        radarTrackingTrigger();
      }
      if (characterID == null) {
        return GetCharacterID();
      }
    }
  })
  .then( () => {
    return axios({
      method: 'get',
      url: 'https://esi.tech.ccp.is/latest/characters/'+characterID+'/location/?token='+token
    })
  })
  .then( (response) => {
    if (characterLocation == response.data['solar_system_id']) {throw 'no update';}
    characterLocation = response.data['solar_system_id'];
    return axios({
      method: 'get',
      url: 'https://esi.tech.ccp.is/latest/universe/systems/'+response.data['solar_system_id']+'/'
    })
  })
  .then( (response) => {
    systemName = response.data['name'].replace(/ /gi, '_');
    return axios({
      method: 'get',
      url: 'https://esi.tech.ccp.is/latest/universe/constellations/'+response.data['constellation_id']+'/'
    })
  })
  .then( (response) => {
    return axios({
      method: 'get',
      url: 'https://esi.tech.ccp.is/latest/universe/regions/'+response.data['region_id']+'/'
    })
  })
  .then( (response) => {
    var region = response.data['name'].replace(/ /gi, '_');
    reactiveData.characterLocation = systemName+', '+region;
    if (location.href.split('#')[0] != 'http://evemaps.dotlan.net/map/'+region+'/'+systemName) {
      window.location.href = 'http://evemaps.dotlan.net/map/'+region+'/'+systemName
    }
  })
  .catch( error => {
    if (error == 'no update'){
      throw 'no update';
    }
    else if (error == 'tracking stopped'){
      throw 'tracking stopped';
    }
    console.log(error);
    return localGet_Promise('radarToken')
    .then( (items) => {
      if (token != items['radarToken']) {
        token = (typeof items['radarToken'] == 'undefined') ? null : items['radarToken'];
        chrome.storage.local.get('radarRefreshToken', (items) => {refreshToken = items['radarRefreshToken'];});
        throw 'new token found';
      }
      return localGet_Promise('radarRefreshToken')
      .then( (items) => {
        refreshToken = (typeof items['radarRefreshToken'] == 'undefined') ? null : items['radarRefreshToken'];
        if (refreshToken == null) {
          SetLogoutStateTopbar();
          throw 'refreshToken gone, setting logged out state';
        }
        return AttemptRefreshToken(refreshToken);
      })
    })
  })
  .catch( error => {
    if (error == 'no update' || error == 'new token found' || error == 'tracking stopped'){
      return Promise.resolve();
    }
    console.log(error);
  });
}

function ExtractAuthCode(url) {
  if(url.indexOf('#?code=') > -1) {
    var code = url.split('#?code=')[1];
    return axios({
      method: 'post',
      url: 'https://login.eveonline.com/oauth/token',
      headers: {
        Authorization: atob("QmFzaWMgTVRRNE1qY3lNRFprWkRCbE5HTTFaRGd3TmpCa016Vmxaall6WWpsbFpXTTZhekU0YmtKNU5uVmhhMHB5UjB0dlIxaENVRkoxY2paak4yNUlUMUp4TkdFelpVNTRZalZ0T0E9PQ==")
      },
      data: 'grant_type=authorization_code&code='+code
    })
    .then( (response) => {
      token = response.data['access_token'];
      refreshToken = response.data['refresh_token'];
      chrome.storage.local.set({radarToken: token});
      chrome.storage.local.set({radarRefreshToken: refreshToken});
      chrome.storage.local.set({radarTrackingEnabled: true});
    })
    .catch( (error) => {
      console.log(error);
    })
  }
  else {
    return Promise.resolve();
  }
}

function AttemptRefreshToken(tokenArg) {
  return axios({
    method: 'post',
    url: 'https://login.eveonline.com/oauth/token',
    headers: {
      Authorization: atob("QmFzaWMgTVRRNE1qY3lNRFprWkRCbE5HTTFaRGd3TmpCa016Vmxaall6WWpsbFpXTTZhekU0YmtKNU5uVmhhMHB5UjB0dlIxaENVRkoxY2paak4yNUlUMUp4TkdFelpVNTRZalZ0T0E9PQ==")
    },
    data: 'grant_type=refresh_token&refresh_token='+tokenArg
  })
  .then( (response) => {
    token = response.data['access_token'];
    refreshToken = response.data['refresh_token'];
    chrome.storage.local.set({radarToken: token});
    chrome.storage.local.set({radarRefreshToken: refreshToken});
  })
  .catch( (error) => {
    console.log(error);
    RevokeToken();
    throw error;
  })
}

function RevokeToken() {
  axios({
    method: 'post',
    url: 'https://login.eveonline.com/oauth/revoke',
    headers: {
      Authorization: atob("QmFzaWMgTVRRNE1qY3lNRFprWkRCbE5HTTFaRGd3TmpCa016Vmxaall6WWpsbFpXTTZhekU0YmtKNU5uVmhhMHB5UjB0dlIxaENVRkoxY2paak4yNUlUMUp4TkdFelpVNTRZalZ0T0E9PQ==")
    },
    data: 'token_type_hint=access_token&token='+token
  })
  .then( (response) => {
    token = null;
    chrome.storage.local.set({radarToken: token});
  });
  axios({
    method: 'post',
    url: 'https://login.eveonline.com/oauth/revoke',
    headers: {
      Authorization: atob("QmFzaWMgTVRRNE1qY3lNRFprWkRCbE5HTTFaRGd3TmpCa016Vmxaall6WWpsbFpXTTZhekU0YmtKNU5uVmhhMHB5UjB0dlIxaENVRkoxY2paak4yNUlUMUp4TkdFelpVNTRZalZ0T0E9PQ==")
    },
    data: 'token_type_hint=refresh_token&token=='+refreshToken
  })
  .then( (response) => {
    refreshToken = null;
    chrome.storage.local.set({radarRefreshToken: refreshToken});
    chrome.storage.local.set({radarTrackingEnabled: true});
  });
  SetLogoutStateTopbar();
}

function SetLogoutStateTopbar() {
  reactiveData.signInText = 'Sign in';
  reactiveData.signInLink = ESI_login_url+ESI_query_string;
  reactiveData.signInOnClick = '';
  reactiveData.signInRole = '';
  reactiveData.characterName = 'No character logged in';
  reactiveData.charLocationDisplay = 'none';
  reactiveData.notifierDisplay = 'none';
  reactiveData.topbarContainerAnimation = 'slideIn 1s ease-out 0.5s 1 forwards';
  reactiveData.topbarContainerAnimationModifier = 'slideIn 1s ease-out 0.5s 1 forwards';
  reactiveData.characterPortrait = '';
  if (reactiveData.trackingTriggerText == 'Stop Tracking') {
    radarTrackingTrigger();
  }
  characterID = null;
  token = null;
  chrome.storage.local.set({radarToken: token});
}

function radarTrackingTrigger() {
  if (reactiveData.trackingTriggerText == 'Stop Tracking') {
    reactiveData.trackingTriggerText = 'Start Tracking';
    reactiveData.notifierData = 'Not Tracking | ';
    reactiveData.topbarContainerAnimation = 'slideIn 1s ease-out 0.5s 1 forwards';
    reactiveData.topbarContainerAnimationModifier = 'slideIn 1s ease-out 0.5s 1 forwards';
    radarTrackingEnabled = false;
    chrome.storage.local.set({radarTrackingEnabled: radarTrackingEnabled});
  }
  else {
    reactiveData.trackingTriggerText = 'Stop Tracking';
    reactiveData.notifierData = 'Tracking... | ';
    reactiveData.topbarContainerAnimation = 'none';
    reactiveData.topbarContainerAnimationModifier = 'none';
    radarTrackingEnabled = true;
    chrome.storage.local.set({radarTrackingEnabled: radarTrackingEnabled});
  }
}

function syncData() {
  return localGet_Promise('radarTrackingEnabled')
  .then( (items) => {
    radarTrackingEnabled = (typeof items['radarTrackingEnabled'] == 'undefined') ? true : items['radarTrackingEnabled'];
    return localGet_Promise('radarToken');
  })
  .then( (items) => {
    token = (typeof items['radarToken'] == 'undefined') ? null : items['radarToken'];
    return localGet_Promise('radarRefreshToken');
  })
  .then( (items) => {
    refreshToken = (typeof items['radarRefreshToken'] == 'undefined') ? null : items['radarRefreshToken'];
  })
}

var token = null;
var refreshToken = null;
var radarTrackingEnabled = true;
var systemName = null;
var characterLocation = null;
var characterID = null;
var characterHeartbeat = null;
reactiveData.trackingTriggerFunction = radarTrackingTrigger

const localGet_Promise = key => new Promise(resolve => chrome.storage.local.get(key, resolve));

ExtractAuthCode(location.href)
.then( () => {
  return localGet_Promise('radarRefreshToken');
})
.then( (items) => {
  refreshToken = (typeof items['radarRefreshToken'] == 'undefined') ? null : items['radarRefreshToken'];
  if (refreshToken != null) {
    reactiveData.signInText = 'Sign Out';
    reactiveData.signInOnClick = RevokeToken;
    reactiveData.signInLink = 'javascript:;';
  }
  return localGet_Promise('radarToken');
})
.then( (items) => {
  token = (typeof items['radarToken'] == 'undefined') ? null : items['radarToken'];
  if (token == null && refreshToken != null) {
    return AttemptRefreshToken(refreshToken);
  }
})
.then( () => {
  return localGet_Promise('radarTrackingEnabled');
})
.then( (items) => {
  radarTrackingEnabled = (typeof items['radarTrackingEnabled'] == 'undefined') ? true : items['radarTrackingEnabled'];
  if(token != null && radarTrackingEnabled == true) {
    return GetCharacterID();
  }
  else if (token != null) {
    return GetCharacterID().then( () => {
      radarTrackingTrigger();
    })
  }
})
.then ( () => {
  characterHeartbeat = setInterval(FindCharacter, 1000);
});

