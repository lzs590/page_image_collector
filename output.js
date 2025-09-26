/* global chrome */

(async function() {
	function qs(k, def = '') {
		const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
		const params = new URLSearchParams(h);
		return params.get(k) || def;
	}

	function fileNameFromUrl(u) {
		try {
			const url = new URL(u);
			const name = url.pathname.split('/').pop() || 'image';
			return decodeURIComponent(name.split('?')[0]) || 'image';
		} catch (e) { return 'image'; }
	}

	// 图片数据结构
	let imageData = [];

	function render(images) {
		const grid = document.getElementById('grid');
		grid.innerHTML = '';
		
		// 检查是否有图片
		if (!images || images.length === 0) {
			grid.innerHTML = `
				<div class="empty-state">
					<div class="empty-state-icon">🖼️</div>
					<div class="empty-state-text">没有找到图片</div>
					<div class="empty-state-subtext">请确保页面包含图片元素</div>
				</div>
			`;
			document.getElementById('count').textContent = '0 张图片';
			return;
		}
		
		// 初始化图片数据
		imageData = images.map((src, index) => {
			const url = new URL(src);
			const ext = (fileNameFromUrl(src).split('.').pop() || '').toLowerCase();
			return {
				src,
				index,
				ext,
				domain: url.hostname,
				width: 0,
				height: 0,
				source: 'unknown', // 将在加载时确定
				loaded: false
			};
		});
		
		// 添加加载状态
		grid.classList.add('loading');
		
		imageData.forEach((imgData, index) => {
			const card = document.createElement('label');
			card.className = 'card fade-in';
			card.style.animationDelay = `${index * 0.05}s`;
			card.dataset.src = imgData.src;
			card.dataset.index = index;
			
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.className = 'checkbox';
			checkbox.checked = true;
			checkbox.dataset.src = imgData.src;
			
			const img = document.createElement('img');
			img.className = 'thumb';
			img.loading = 'lazy';
			img.src = imgData.src;
			
			// 添加图片加载成功处理
			img.onload = () => {
				imgData.width = img.naturalWidth;
				imgData.height = img.naturalHeight;
				imgData.loaded = true;
				updateCardInfo(card, imgData);
			};
			
			// 添加图片加载错误处理
			img.onerror = () => {
				img.style.background = 'linear-gradient(135deg, #f1f5f9, #e2e8f0)';
				img.style.display = 'flex';
				img.style.alignItems = 'center';
				img.style.justifyContent = 'center';
				img.innerHTML = '❌';
			};
			
			const meta = document.createElement('div');
			meta.className = 'meta';
			meta.innerHTML = `
				<span class="filename">${fileNameFromUrl(imgData.src)}</span>
				<span class="size-info">加载中...</span>
			`;
			
			card.appendChild(img);
			card.appendChild(checkbox);
			card.appendChild(meta);
			grid.appendChild(card);
			
			// 添加卡片点击事件
			card.addEventListener('click', (e) => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
					updateCardSelection(card, checkbox.checked);
				}
			});
			
			// 添加复选框变化事件
			checkbox.addEventListener('change', () => {
				updateCardSelection(card, checkbox.checked);
			});
		});
		
		// 移除加载状态
		setTimeout(() => {
			grid.classList.remove('loading');
		}, 300);
		
		document.getElementById('count').textContent = `${images.length} 张图片`;
		updateStats();
	}

	function updateCardInfo(card, imgData) {
		const sizeInfo = card.querySelector('.size-info');
		if (sizeInfo && imgData.loaded) {
			sizeInfo.textContent = `${imgData.width}×${imgData.height}`;
		}
	}
	
	function updateCardSelection(card, isSelected) {
		if (isSelected) {
			card.classList.add('selected');
		} else {
			card.classList.remove('selected');
		}
		updateStats();
	}
	
	function updateStats() {
		const totalImages = document.querySelectorAll('.card').length;
		const selectedImages = document.querySelectorAll('.checkbox:checked').length;
		document.getElementById('count').textContent = `${selectedImages}/${totalImages} 张图片`;
	}

	// 筛选功能
	function applyFilters() {
		const keyword = document.getElementById('kw').value.toLowerCase();
		const format = document.getElementById('format-filter').value;
		const minWidth = parseInt(document.getElementById('min-width').value) || 0;
		const minHeight = parseInt(document.getElementById('min-height').value) || 0;
		const quality = document.getElementById('quality-filter').value;
		const source = document.getElementById('source-filter').value;
		const domain = document.getElementById('domain-filter').value.toLowerCase();

		const cards = document.querySelectorAll('.card');
		let visibleCount = 0;

		cards.forEach(card => {
			const index = parseInt(card.dataset.index);
			const imgData = imageData[index];
			if (!imgData) return;

			let matches = true;

			// 关键词筛选
			if (keyword) {
				const src = imgData.src.toLowerCase();
				const filename = fileNameFromUrl(imgData.src).toLowerCase();
				matches = matches && (src.includes(keyword) || filename.includes(keyword));
			}

			// 格式筛选
			if (format && matches) {
				const formats = format.split(',');
				matches = matches && formats.includes(imgData.ext);
			}

			// 尺寸筛选
			if (matches && (minWidth > 0 || minHeight > 0)) {
				if (imgData.loaded) {
					matches = matches && imgData.width >= minWidth && imgData.height >= minHeight;
				} else {
					// 如果图片未加载，暂时显示，加载后重新筛选
					matches = true;
				}
			}

			// 质量筛选
			if (matches && quality) {
				if (imgData.loaded) {
					const maxDimension = Math.max(imgData.width, imgData.height);
					switch (quality) {
						case 'high':
							matches = matches && maxDimension >= 1000;
							break;
						case 'medium':
							matches = matches && maxDimension >= 500 && maxDimension < 1000;
							break;
						case 'low':
							matches = matches && maxDimension < 500;
							break;
					}
				} else {
					matches = true; // 未加载时暂时显示
				}
			}

			// 来源筛选
			if (matches && source) {
				// 这里需要根据实际来源设置，暂时使用URL判断
				const isImg = imgData.src.includes('img') || imgData.src.includes('image');
				const isBackground = imgData.src.includes('background') || imgData.src.includes('bg');
				
				switch (source) {
					case 'img':
						matches = matches && isImg;
						break;
					case 'background':
						matches = matches && isBackground;
						break;
				}
			}

			// 域名筛选
			if (matches && domain) {
				matches = matches && imgData.domain.toLowerCase().includes(domain);
			}

			// 应用筛选结果
			card.style.display = matches ? 'flex' : 'none';
			if (matches) visibleCount++;
		});

		// 更新统计信息
		const selectedVisible = Array.from(cards).filter(card => 
			card.style.display !== 'none' && card.querySelector('.checkbox').checked
		).length;
		document.getElementById('count').textContent = `${selectedVisible}/${visibleCount} 张图片`;
	}

	// 清除所有筛选
	function clearFilters() {
		document.getElementById('kw').value = '';
		document.getElementById('format-filter').value = '';
		document.getElementById('min-width').value = '';
		document.getElementById('min-height').value = '';
		document.getElementById('quality-filter').value = '';
		document.getElementById('source-filter').value = '';
		document.getElementById('domain-filter').value = '';
		applyFilters();
		showNotification('已清除所有筛选条件', 'info');
	}

	function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

	function parseTemplate(tpl, url, idx, pageTitle) {
		const u = (() => { try { return new URL(url); } catch (e) { return null; } })();
		const ext = (fileNameFromUrl(url).split('.').pop() || '').toLowerCase() || 'jpg';
		const n = String(idx + 1);
		const n0001 = n.padStart(4, '0');
		return tpl
			.replaceAll('{HOST}', u ? u.host : 'host')
			.replaceAll('{PTITLE}', pageTitle || document.title || 'page')
			.replaceAll('{N}', n)
			.replaceAll('{N0001}', n0001)
			.replaceAll('{EXT}', ext);
	}

	function b64ToUint8(b64) {
		const binary = atob(b64);
		const len = binary.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	}

	async function fetchArrayBuffer(url) {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage({ type: 'FETCH_ARRAY_BUFFER', url }, (res) => {
				if (!res || !res.ok) return resolve(null);
				try { resolve(b64ToUint8(res.b64).buffer); } catch (e) { resolve(null); }
			});
		});
	}

	async function downloadAsZip(urls, options) {
		try {
			const writer = new self.MiniZipWriter();
			let i = 0;
			for (const u of urls) {
				const name = parseTemplate(options.template, u, i++, options.pageTitle || 'page');
				const buf = await fetchArrayBuffer(u);
				if (buf) writer.addFile(name, new Uint8Array(buf));
			}
			const blob = writer.finalizeBlob();
			const url = URL.createObjectURL(blob);
			await chrome.downloads.download({ url, filename: `${(document.title || 'images').replace(/[/\\:*?"<>|]/g,'_')}.zip` });
			URL.revokeObjectURL(url);
		} catch (e) {
			console.warn('zip build failed, fallback to per-file', e);
			await downloadMany(urls, options);
		}
	}

	async function downloadMany(urls, options) {
		const {
			concurrency = 4,
			retries = 2,
			delayMin = 100,
			delayMax = 400,
			template = 'mini/{PTITLE}/P_{N0001}.{EXT}',
			pageTitle = document.title
		} = options || {};
		let active = 0, idx = 0;
		const queue = urls.slice();
		async function runOne(u, iTry = 0) {
			try {
				const name = parseTemplate(template, u, idx++, pageTitle);
				await chrome.downloads.download({ url: u, filename: name });
			} catch (e) {
				if (iTry < retries) return runOne(u, iTry + 1);
				console.warn('download failed', u, e);
			}
			const wait = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
			await sleep(wait);
		}
		async function loop() {
			while (queue.length) {
				if (active >= concurrency) { await sleep(50); continue; }
				active++;
				const u = queue.shift();
				runOne(u).finally(() => { active--; });
			}
			while (active > 0) { await sleep(50); }
		}
		await loop();
	}

	const tabId = Number(qs('tab', '0'));
	const key = `images_${tabId}`;
	const store = await chrome.storage.local.get([key, 'origin_title']);
	const images = Array.isArray(store[key]) ? store[key] : [];
	document.getElementById('origin').textContent = store.origin_title || '';
	render(images);

	const elTpl = document.getElementById('tpl');
	const elKw = document.getElementById('kw');
	const swZip = document.getElementById('opt-zip');
	const elDelayMin = document.getElementById('delay-min');
	const elDelayMax = document.getElementById('delay-max');
	const elConcurrency = document.getElementById('concurrency');
	const elRetries = document.getElementById('retries');

	function getOptions() {
		return {
			template: elTpl.value || 'mini/{PTITLE}/P_{N0001}.{EXT}',
			concurrency: Math.max(1, Number(elConcurrency.value || 4)),
			retries: Math.max(0, Number(elRetries.value || 2)),
			delayMin: Math.max(0, Number(elDelayMin.value || 100)),
			delayMax: Math.max(0, Number(elDelayMax.value || 400)),
			pageTitle: document.title
		};
	}

	document.getElementById('btn-download-all').addEventListener('click', async () => {
		const opts = getOptions();
		// 获取所有可见的图片
		const visibleCards = Array.from(document.querySelectorAll('.card')).filter(card => card.style.display !== 'none');
		const filtered = visibleCards.map(card => card.dataset.src).filter(Boolean);
		await startDownload(filtered, opts, '全部');
	});

	document.getElementById('btn-download-selected').addEventListener('click', async () => {
		const opts = getOptions();
		// 获取所有可见且选中的图片
		const visibleCards = Array.from(document.querySelectorAll('.card')).filter(card => card.style.display !== 'none');
		const selected = visibleCards
			.filter(card => card.querySelector('.checkbox').checked)
			.map(card => card.dataset.src)
			.filter(Boolean);
		await startDownload(selected, opts, '选中');
	});
	
	async function startDownload(urls, opts, type) {
		if (urls.length === 0) {
			showNotification('没有可下载的图片', 'warning');
			return;
		}
		
		// 禁用按钮并显示加载状态
		const downloadBtns = document.querySelectorAll('#btn-download-all, #btn-download-selected');
		downloadBtns.forEach(btn => {
			btn.disabled = true;
			btn.classList.add('loading');
			const originalText = btn.textContent;
			btn.innerHTML = '<span>⏳</span> 下载中...';
		});
		
		try {
			showNotification(`开始下载${type} ${urls.length} 张图片`, 'info');
			
			if (swZip.classList.contains('on')) {
				await downloadAsZip(urls, opts);
			} else {
				await downloadMany(urls, opts);
			}
			
			showNotification(`成功下载${type} ${urls.length} 张图片`, 'success');
		} catch (error) {
			console.error('Download failed:', error);
			showNotification(`下载失败: ${error.message}`, 'error');
		} finally {
			// 恢复按钮状态
			downloadBtns.forEach(btn => {
				btn.disabled = false;
				btn.classList.remove('loading');
				btn.innerHTML = btn.id === 'btn-download-all' ? '<span>📦</span> 下载全部' : '<span>📥</span> 下载选中';
			});
		}
	}
	
	function showNotification(message, type = 'info') {
		// 创建通知元素
		const notification = document.createElement('div');
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 1rem 1.5rem;
			border-radius: 0.5rem;
			color: white;
			font-weight: 600;
			z-index: 1000;
			transform: translateX(100%);
			transition: transform 0.3s ease;
			box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
		`;
		
		// 根据类型设置颜色
		const colors = {
			info: '#3b82f6',
			success: '#10b981',
			warning: '#f59e0b',
			error: '#ef4444'
		};
		notification.style.background = colors[type] || colors.info;
		
		notification.textContent = message;
		document.body.appendChild(notification);
		
		// 显示动画
		setTimeout(() => {
			notification.style.transform = 'translateX(0)';
		}, 100);
		
		// 自动隐藏
		setTimeout(() => {
			notification.style.transform = 'translateX(100%)';
			setTimeout(() => {
				document.body.removeChild(notification);
			}, 300);
		}, 3000);
	}

	// switches and toolbar
	swZip.addEventListener('click', () => {
		swZip.classList.toggle('on');
		const isOn = swZip.classList.contains('on');
		showNotification(isOn ? '已启用ZIP打包下载' : '已禁用ZIP打包下载', 'info');
	});
	
	document.getElementById('btn-select-all').addEventListener('click', () => {
		const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
		const allChecked = checkboxes.every(cb => cb.checked);
		
		checkboxes.forEach(cb => {
			cb.checked = !allChecked;
			const card = cb.closest('.card');
			updateCardSelection(card, cb.checked);
		});
		
		showNotification(allChecked ? '已取消全选' : '已全选所有图片', 'info');
	});
	
	document.getElementById('btn-invert').addEventListener('click', () => {
		const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
		checkboxes.forEach(cb => {
			cb.checked = !cb.checked;
			const card = cb.closest('.card');
			updateCardSelection(card, cb.checked);
		});
		
		showNotification('已反选所有图片', 'info');
	});
	
	// 筛选器事件监听
	const filterInputs = [
		'kw', 'format-filter', 'min-width', 'min-height', 
		'quality-filter', 'source-filter', 'domain-filter'
	];
	
	filterInputs.forEach(id => {
		const element = document.getElementById(id);
		if (element) {
			element.addEventListener('input', applyFilters);
			element.addEventListener('change', applyFilters);
		}
	});

	// 清除筛选按钮
	document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

	// drag selection rectangle
	(function enableDragSelect() {
		const grid = document.getElementById('grid');
		let start = null; let rect = null;
		function getBox(e) { return { x: e.pageX, y: e.pageY }; }
		function overlap(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
		grid.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			start = getBox(e);
			rect = document.createElement('div'); 
			rect.className = 'select-rect'; 
			document.body.appendChild(rect);
		});
		
		document.addEventListener('mousemove', (e) => {
			if (!start || !rect) return;
			const x1 = Math.min(start.x, e.pageX), y1 = Math.min(start.y, e.pageY);
			const x2 = Math.max(start.x, e.pageX), y2 = Math.max(start.y, e.pageY);
			rect.style.left = x1 + 'px'; 
			rect.style.top = y1 + 'px'; 
			rect.style.width = (x2 - x1) + 'px'; 
			rect.style.height = (y2 - y1) + 'px';
			const box = { left: x1, top: y1, right: x2, bottom: y2 };
			
			Array.from(document.querySelectorAll('.card')).forEach(card => {
				// 只处理可见的卡片
				if (card.style.display === 'none') return;
				
				const r = card.getBoundingClientRect();
				const cr = { 
					left: r.left + window.scrollX, 
					right: r.right + window.scrollX, 
					top: r.top + window.scrollY, 
					bottom: r.bottom + window.scrollY 
				};
				const hit = overlap(box, cr);
				const chk = card.querySelector('input[type="checkbox"]');
				if (chk) {
					chk.checked = hit;
					updateCardSelection(card, hit);
				}
			});
		});
		
		document.addEventListener('mouseup', () => { 
			if (rect) rect.remove(); 
			rect = null; 
			start = null; 
		});
	})();
})();



