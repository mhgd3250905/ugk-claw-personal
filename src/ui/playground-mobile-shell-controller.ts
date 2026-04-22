export function getPlaygroundMobileShellElementRefsScript(): string {
	return `
		const mobileTopbar = document.getElementById("mobile-topbar");
		const mobileBrandButton = document.getElementById("mobile-brand-button");
		const mobileNewConversationButton = document.getElementById("mobile-new-conversation-button");
		const mobileOverflowMenuButton = document.getElementById("mobile-overflow-menu-button");
		const mobileOverflowMenu = document.getElementById("mobile-overflow-menu");
		const mobileMenuSkillsButton = document.getElementById("mobile-menu-skills-button");
		const mobileMenuFileButton = document.getElementById("mobile-menu-file-button");
		const mobileMenuLibraryButton = document.getElementById("mobile-menu-library-button");
		const mobileMenuActivityButton = document.getElementById("mobile-menu-activity-button");
		const mobileMenuConnButton = document.getElementById("mobile-menu-conn-button");
		const mobileDrawerBackdrop = document.getElementById("mobile-drawer-backdrop");
		const mobileConversationDrawer = document.getElementById("mobile-conversation-drawer");
		const mobileConversationList = document.getElementById("mobile-conversation-list");
		const mobileDrawerCloseButton = document.getElementById("mobile-drawer-close-button");
	`;
}

export function getPlaygroundMobileShellControllerScript(): string {
	return `
		function setMobileOverflowMenuOpen(next) {
			state.mobileOverflowMenuOpen = Boolean(next);
			mobileOverflowMenu.hidden = !state.mobileOverflowMenuOpen;
			mobileOverflowMenuButton.setAttribute("aria-expanded", state.mobileOverflowMenuOpen ? "true" : "false");
		}

		function closeMobileOverflowMenu() {
			setMobileOverflowMenuOpen(false);
		}

		function setMobileConversationDrawerOpen(next) {
			state.mobileConversationDrawerOpen = Boolean(next);
			mobileDrawerBackdrop.hidden = !state.mobileConversationDrawerOpen;
			mobileConversationDrawer.hidden = !state.mobileConversationDrawerOpen;
			mobileBrandButton.setAttribute("aria-expanded", state.mobileConversationDrawerOpen ? "true" : "false");
			if (state.mobileConversationDrawerOpen) {
				closeMobileOverflowMenu();
				renderConversationDrawer();
			}
		}

		function closeMobileConversationDrawer() {
			setMobileConversationDrawerOpen(false);
		}
	`;
}

export function getPlaygroundMobileShellEventHandlersScript(): string {
	return `
		mobileNewConversationButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			void startNewConversation().then((created) => {
				if (created) {
					messageInput.focus();
				}
			});
		});
		mobileBrandButton.addEventListener("click", (event) => {
			event.stopPropagation();
			setMobileConversationDrawerOpen(!state.mobileConversationDrawerOpen);
			void syncConversationCatalog({
				silent: true,
				activateCurrent: false,
			});
		});
		mobileDrawerBackdrop.addEventListener("click", closeMobileConversationDrawer);
		mobileDrawerCloseButton.addEventListener("click", closeMobileConversationDrawer);
		mobileOverflowMenuButton.addEventListener("click", (event) => {
			event.stopPropagation();
			setMobileOverflowMenuOpen(!state.mobileOverflowMenuOpen);
		});
		mobileMenuSkillsButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			void loadSkills();
		});
		mobileMenuFileButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			fileInput.click();
		});
		mobileMenuLibraryButton.addEventListener("click", () => {
			closeMobileOverflowMenu();
			openAssetLibrary();
		});

		document.addEventListener("click", (event) => {
			if (!state.mobileOverflowMenuOpen) {
				return;
			}
			if (!mobileTopbar.contains(event.target)) {
				closeMobileOverflowMenu();
			}
		});
	`;
}
