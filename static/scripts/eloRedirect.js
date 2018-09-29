// --------- ENUM/CONSTANTS --------------

var REDIRECT_URL = '/elo/',

	REDIRECT_ASSISTANT = 'redirectAssistant';

// --------- STATIC VARIABLES --------------

var weekIndex = document.getElementById(REDIRECT_ASSISTANT).innerHTML;

// --------- REDIRECT LOGIC --------------

window.location.replace(REDIRECT_URL + weekIndex);