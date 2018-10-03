// --------- ENUM/CONSTANTS --------------

var WEEK_DROPDOWN = 'weekDropdown',

	ELO_URL = '/elo/';

// --------- STATIC VARIABLES --------------

var _weekSelector = document.getElementById(WEEK_DROPDOWN);

// --------- LISTENERS --------------

/**
 * Listener meant to toggle the week for which to show Elo scores
 *
 * @author kinsho
 */
function weekToggler()
{
	window.location.href = ELO_URL + _weekSelector.value;	
}

// --------- INITIALIZATION --------------

_weekSelector.addEventListener('change', weekToggler);