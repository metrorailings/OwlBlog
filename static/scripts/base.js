// --------- ENUM/CONSTANTS --------------

var OPEN_CLASS = 'open';

// --------- STATIC VARIABLES --------------

var _mobileMenuElement = document.getElementById('mobileSiteMenu'),
	_mobileMenuOptions = document.getElementById('mobileMenuLinks');

// --------- LISTENERS --------------

/**
 * Listener meant to toggle the visibility of the menu that will be shown only on mobile devices
 *
 * @param {Event} event - the event associated with the invocation of this listener
 *
 * @author kinsho
 */
function toggleMobileMenu(event)
{
	event.stopPropagation();

	if (_mobileMenuOptions.classList.contains(OPEN_CLASS))
	{
		_mobileMenuOptions.classList.remove(OPEN_CLASS);
	}
	else
	{
		_mobileMenuOptions.classList.add(OPEN_CLASS);
	}
}

/**
 * Listener meant to hide the menu that will be shown only on mobile devices
 *
 * @author kinsho
 */
function hideMobileMenu()
{
	_mobileMenuOptions.classList.remove(OPEN_CLASS);
}

// --------- INITIALIZATION --------------

_mobileMenuElement.addEventListener('click', toggleMobileMenu);
document.body.addEventListener('click', hideMobileMenu);