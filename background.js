/* global chrome */

const MENU_ID = "mini_ext_open";

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({ id: MENU_ID, title: "使用图片下载器打开", contexts: ["page", "image", "selection", "link"] });
});

async function getActiveTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

async function collect(tabId) {
	try {
		const [{ result } = {}] = await chrome.scripting.executeScript({
			target: { tabId },
			func: () => {
				function absolutize(url) {
					try { return new URL(url, location.href).href; } catch (e) { return url; }
				}
				function pickFromImg(img) {
					const srcset = img.getAttribute('srcset') || '';
					let best = img.currentSrc || img.src || '';
					if (srcset) {
						const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
						if (parts.length) best = parts[parts.length - 1].split(' ')[0] || best;
					}
					return { url: absolutize(best), source: 'img' };
				}
				function pickFromBg(el) {
					const bg = getComputedStyle(el).backgroundImage;
					const m = bg && bg !== 'none' ? bg.match(/url\(["']?(.*?)["']?\)/i) : null;
					return m ? { url: absolutize(m[1]), source: 'background' } : { url: '', source: 'background' };
				}
				function dedupe(items) {
					const map = new Map();
					for (const item of items) {
						if (!item || !item.url) continue;
						try {
							const { pathname, host } = new URL(item.url);
							const key = (pathname.split('/').pop() || pathname) + '|' + host;
							const prev = map.get(key);
							if (!prev || item.url.length > prev.url.length) map.set(key, item);
						} catch (e) { map.set(item.url, item); }
					}
					return Array.from(map.values());
				}
				const items = [];
				document.querySelectorAll('img').forEach(img => {
					const result = pickFromImg(img);
					if (result.url) items.push(result);
				});
				document.querySelectorAll('*').forEach(el => { 
					const result = pickFromBg(el); 
					if (result.url) items.push(result); 
				});
				return dedupe(items).map(item => item.url);
			}
		});
		return Array.isArray(result) ? result : [];
	} catch (e) { return []; }
}

async function openOutput(tabId, images) {
	const key = `images_${tabId}`;
	await chrome.storage.local.set({ [key]: images, origin_title: '图片批量下载' });
	const url = chrome.runtime.getURL(`output.html#tab=${tabId}`);
	await chrome.tabs.create({ url });
}

async function onTrigger(tab) {
	if (!tab || !tab.id) return;
	const images = await collect(tab.id);
	await openOutput(tab.id, images);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId === MENU_ID) {
		await onTrigger(tab);
	}
});

const actionApi = (chrome.action && chrome.action.onClicked) || (chrome.browserAction && chrome.browserAction.onClicked);
if (actionApi) {
	actionApi.addListener(async (tab) => { await onTrigger(tab); });
}

// Background fetch proxy for CORS-restricted images
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg && msg.type === 'FETCH_ARRAY_BUFFER' && msg.url) {
		(async () => {
			try {
				const res = await fetch(msg.url, { credentials: 'omit', cache: 'no-store' });
				const buf = await res.arrayBuffer();
				// Encode to base64 to avoid structured clone edge cases
				const u8 = new Uint8Array(buf);
				let binary = '';
				const chunk = 0x8000;
				for (let i = 0; i < u8.length; i += chunk) {
					binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
				}
				const b64 = btoa(binary);
				sendResponse({ ok: true, b64, status: res.status, mime: res.headers.get('content-type') || '' });
			} catch (e) {
				sendResponse({ ok: false, error: String(e) });
			}
		})();
		return true; // keep message channel open
	}
});


