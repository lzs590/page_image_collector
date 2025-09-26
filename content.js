(function() {
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
		if (!bg || bg === 'none') return { url: '', source: 'background' };
		const m = bg.match(/url\(["']?(.*?)["']?\)/i);
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

	function collectAll() {
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

	window.addEventListener('message', (e) => {
		const data = e && e.data;
		if (!data || data.type !== 'MINI_COLLECT_IMAGES') return;
		const images = collectAll();
		window.postMessage({ type: 'MINI_IMAGES', channel: data.channel, images }, '*');
	});
})();


