/* =========================================================
 * VS Code Webview – Flowchart Panel
 * - Mermaid flowchart render + interactions
 * - Pseudocode render + line selection
 * - Message bridge with extension (postMessage / onmessage)
 * Notes:
 * - This file expects to be loaded with <script ... defer>
 * ========================================================= */

/* ---------- VS Code API ---------- */
const vscode = acquireVsCodeApi();

/* ---------- Embedded JSON Data ---------- */
const nodeOrderJsonTag = document.getElementById('node-order-json');
let nodeOrder = [];
try {
	nodeOrder = JSON.parse(nodeOrderJsonTag?.textContent || '[]');
} catch (_) {
	nodeOrder = [];
}

/* ---------- A) Global state  ---------- */
const state = {
	currentScale: 1,
	currentHighlightedNodes: [],
	currentHighlightedPseudocodeLines: [],
	lineMapping: {},
	zoomTimeout: null,
	dragTimeout: null,
	isDragging: false,
	startX: 0,
	startY: 0,
	scrollLeft: 0,
	scrollTop: 0,
	// 保留 nodeOrder 於 state，方便後端更新與前端使用
	nodeOrder,
};

/* ---------- A.1) DOM References (cache common nodes) ---------- */
const dom = {
	mermaidContainer: document.getElementById('mermaid-container'),
	zoomIndicator: document.getElementById('zoomIndicator'),
	dragIndicator: document.getElementById('dragIndicator'),
	mermaidWrapper: document.getElementById('mermaid-wrapper'),
	pseudocodeContent: document.getElementById('pseudocode-content'),
};



/* ---------- B) Mermaid init & layout helpers ---------- */

function initMermaidSafe() {
	if (typeof mermaid === 'undefined') {
		console.error('Mermaid not loaded');
		return;
	}
	
	mermaid.initialize({ 
		startOnLoad: true,
		theme: 'default',
		flowchart: {
			useMaxWidth: false,
			htmlLabels: true,
			curve: 'basis'
		},
		securityLevel: 'loose'
	});
	
	mermaid.init(undefined, document.querySelector('.mermaid')).then(() => {
		console.log('Mermaid initialized, node order:', state.nodeOrder);
		centerFlowchart();
	});
}

function centerFlowchart() {
	const container = dom.mermaidContainer;
	const wrapper = dom.mermaidWrapper;
	const flowchart = document.querySelector('.mermaid svg');
	
	if (container && wrapper && flowchart) {
		setTimeout(() => {
			const containerRect = container.getBoundingClientRect();
			const wrapperRect = wrapper.getBoundingClientRect();
			
			const scrollLeft = (wrapper.scrollWidth - containerRect.width) / 2;
			const scrollTop = (wrapper.scrollHeight - containerRect.height) / 2;
			
			container.scrollLeft = scrollLeft;
			container.scrollTop = scrollTop;
			
			console.log('Flowchart centered at:', scrollLeft, scrollTop);
		}, 100);
	}
}

document.addEventListener('DOMContentLoaded', initMermaidSafe);



/* ---------- C) DOM References ---------- */
const mermaidContainer = dom.mermaidContainer;
const zoomIndicator = dom.zoomIndicator;
const dragIndicator = dom.dragIndicator;



/* ---------- D) Flowchart interactions (click/drag/zoom) ---------- */

// D) Flowchart interactions
// 		-- click related
mermaidContainer.addEventListener('click', (e) => {
	const el = e.target.closest('.node');
	if (!el) {return;}

	const rawId = el.id || '';
	let nodeId = rawId.split('-')[1] || rawId;

	if (rawId.includes('Start')) {nodeId = 'Start';}
	if (rawId.includes('End'))   {nodeId = 'End';}

	// 將決策交給後端（避免前端先高亮再被清空閃爍）
	vscode.postMessage({ command: 'webview.FlowchartNodeClicked', nodeId });
});

// D) Flowchart interactions
// 		-- drag related

mermaidContainer.addEventListener('mousemove', (e) => {
	if (!state.isDragging) {return;}
	
	e.preventDefault();
	
	const x = e.pageX - mermaidContainer.offsetLeft;
	const y = e.pageY - mermaidContainer.offsetTop;
	const walkX = (x - state.startX) * 1.5;
	const walkY = (y - state.startY) * 1.5;
	
	mermaidContainer.scrollLeft = state.scrollLeft - walkX;
	mermaidContainer.scrollTop = state.scrollTop - walkY;
});

mermaidContainer.addEventListener('mousedown', (e) => {
	if (e.target.closest('.node')) {
		return;
	}
	
	state.isDragging = true;
	mermaidContainer.classList.add('grabbing');
	
	state.startX = e.pageX - mermaidContainer.offsetLeft;
	state.startY = e.pageY - mermaidContainer.offsetTop;
	state.scrollLeft = mermaidContainer.scrollLeft;
	state.scrollTop = mermaidContainer.scrollTop;
	
	dragIndicator.classList.add('visible');
	
	if (state.dragTimeout) {
		clearTimeout(state.dragTimeout);
	}
	
	e.preventDefault();
});

mermaidContainer.addEventListener('mouseup', () => {
	if (state.isDragging) {
		state.isDragging = false;
		mermaidContainer.classList.remove('grabbing');
		
		state.dragTimeout = setTimeout(() => {
			dragIndicator.classList.remove('visible');
		}, 1000);
	}
});

mermaidContainer.addEventListener('selectstart', (e) => {
	if (state.isDragging) {
		e.preventDefault();
	}
});

mermaidContainer.addEventListener('mouseleave', () => {
	if (state.isDragging) {
		state.isDragging = false;
		mermaidContainer.classList.remove('grabbing');
		
		state.dragTimeout = setTimeout(() => {
			dragIndicator.classList.remove('visible');
		}, 1000);
	}
});


// D) Flowchart interactions
// 		-- zoom related


mermaidContainer.addEventListener('wheel', (e) => {
if (e.ctrlKey || e.metaKey) {
	e.preventDefault();
	
	const zoomSpeed = 0.1;
	const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
	const newScale = Math.min(Math.max(0.1, state.currentScale + delta), 5);
	
	if (newScale !== state.currentScale) {
		state.currentScale = newScale;
		const mermaidEl = document.querySelector('.mermaid');
		mermaidEl.style.transform = 'scale(' + state.currentScale + ')';
		
		// 動態調整 wrapper 尺寸
		const wrapper = dom.mermaidWrapper;
		const svg = mermaidEl.querySelector('svg');
		if (svg) {
			const scaledWidth = svg.getBoundingClientRect().width * state.currentScale;
			const scaledHeight = svg.getBoundingClientRect().height * state.currentScale;
			wrapper.style.minWidth = Math.max(3000, scaledWidth + 2000) + 'px';
			wrapper.style.minHeight = Math.max(3000, scaledHeight + 2000) + 'px';
		}
		
		zoomIndicator.textContent = Math.round(state.currentScale * 100) + '%';
		zoomIndicator.classList.add('visible');
		
		if (state.zoomTimeout) {
			clearTimeout(state.zoomTimeout);
		}
		
		state.zoomTimeout = setTimeout(() => {
			zoomIndicator.classList.remove('visible');
		}, 2000);
	}
}
}, { passive: false });

document.addEventListener('wheel', (e) => {
	if (e.ctrlKey || e.metaKey) {
		e.preventDefault();
	}
}, { passive: false });

function resetView() {
	state.currentScale = 1;
	const mermaidEl = document.querySelector('.mermaid');
	if (mermaidEl) {
		mermaidEl.style.transform = 'scale(1)';
	}
	centerFlowchart();
	
	zoomIndicator.textContent = '100%';
	zoomIndicator.classList.add('visible');
	
	if (state.zoomTimeout) {
		clearTimeout(state.zoomTimeout);
	}
	
	state.zoomTimeout = setTimeout(() => {
		zoomIndicator.classList.remove('visible');
	}, 2000);
}

function resetZoom() {
	resetView();
}



/* ---------- E) Highlight & mapping utilities ---------- */

// 因為mermaid生成的格式是"flowchart-node_10-123"
// 但我只要"node_10" 所以會需要做一些處理
function findNodeElement(nodeId) {
	const elements = document.querySelectorAll('.node');

	for (const el of elements) {
		const elementId = el.id;
		if (elementId) {
			const idParts = elementId.split('-');
			if (idParts.length >= 2) {
				const extractedId = idParts[1];
				if (extractedId === nodeId || 
					(nodeId.startsWith('func_') && elementId.includes(nodeId)) ||
					(nodeId === 'Start' && elementId.includes('Start')) ||
					(nodeId === 'End' && elementId.includes('End'))) {
					return el;
				}
			}
		}
	}
	return null;
}

function clearHighlight() {
	state.currentHighlightedNodes.forEach(el => {
		el.classList.remove('highlighted');
	});
	state.currentHighlightedNodes = [];
}

function clearPseudocodeHighlight() {
	state.currentHighlightedPseudocodeLines.forEach(el => {
		el.classList.remove('highlighted');
	});
	state.currentHighlightedPseudocodeLines = [];
}

function clearHighlightAndEditor() {
	clearHighlight();
	clearPseudocodeHighlight();
	vscode.postMessage({ command: 'webview.requestClearEditor' });
}

function highlightNodes(nodeIds) {
	clearHighlight();                     //發光之前要先清除上一個發光的點
	
	console.log('Highlighting nodes:', nodeIds);
	
	nodeIds.forEach((nodeId, index) => {
		const element = findNodeElement(nodeId);              // 找到節點元素
		if (element) {
			element.classList.add('highlighted');     //加上 highlighted class
			state.currentHighlightedNodes.push(element);
			console.log('Highlighted element:', element.id);
			
			if (index === 0) {
				element.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'center',
					inline: 'center'
				});
				
				const container = dom.mermaidContainer;
				const rect = element.getBoundingClientRect();
				const containerRect = container.getBoundingClientRect();
				
				const scrollLeft = container.scrollLeft + rect.left - containerRect.left - (containerRect.width / 2) + (rect.width / 2);
				const scrollTop = container.scrollTop + rect.top - containerRect.top - (containerRect.height / 2) + (rect.height / 2);
				
				container.scrollTo({
					left: scrollLeft,
					top: scrollTop,
					behavior: 'smooth'
				});
			}
		}
	});
	
	if (state.currentHighlightedNodes.length === 0) {
		console.log('No nodes found to highlight');
	}
}

function setLineMapping(mappingArray) {
	state.lineMapping = {};
	mappingArray.forEach(item => {
		state.lineMapping[item.pythonLine] = item.pseudocodeLine;
	});
	console.log('Line mapping set:', state.lineMapping);
}

function highlightPseudocodeLines(pythonLineNumbers) {
	clearPseudocodeHighlight();
	
	console.log('Highlighting pseudocode for Python lines:', pythonLineNumbers);
	
	pythonLineNumbers.forEach((pythonLine, index) => {
		const pseudoLine = state.lineMapping[pythonLine];
		
		if (pseudoLine) {
			const element = document.getElementById('pseudo-line-' + pseudoLine);
			
			if (element) {
				element.classList.add('highlighted');
				state.currentHighlightedPseudocodeLines.push(element);
				console.log('Python line', pythonLine, 'mapped to Pseudocode line', pseudoLine);
				
				if (index === 0) {
					element.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'center'
					});
				}
			}
		} else {
			console.warn('No mapping found for Python line:', pythonLine);
		}
	});
	
	if (state.currentHighlightedPseudocodeLines.length === 0) {
		console.log('No pseudocode lines found to highlight');
	} else {
		console.log('Successfully highlighted', state.currentHighlightedPseudocodeLines.length, '/', pythonLineNumbers.length, 'lines');
	}
}



/* ---------- F) Pseudocode rendering & interactions ---------- */

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// 在 updatePseudocodeDisplay 函數中修改
function updatePseudocodeDisplay(pseudocode) {
	const pseudocodeContent = dom.pseudocodeContent;
	if (!pseudocodeContent) {return;}

	if (!pseudocode || pseudocode.trim() === '' || pseudocode.trim() === '等待生成 Pseudocode...') {
		pseudocodeContent.innerHTML = '';
		return;
	}

	const lines = pseudocode.split('\n');
	let html = '';
	
	lines.forEach((line, index) => {
		const lineNum = index + 1;
		const lineId = 'pseudo-line-' + lineNum;
		const displayContent = line.trim() === '' ? '&nbsp;' : escapeHtml(line);
		
		html += '<div class="pseudocode-line" id="' + lineId + '" data-line-number="' + lineNum + '" style="cursor: pointer;">' +
				'<span class="line-number">' + lineNum + '</span>' +
				'<span class="line-content">' + displayContent + '</span>' +
				'</div>';
	});
	
	pseudocodeContent.innerHTML = html;
	
	// 添加單行點擊事件
	const pseudoLines = pseudocodeContent.querySelectorAll('.pseudocode-line');
	pseudoLines.forEach(lineEl => {
		lineEl.addEventListener('click', function(e) {
			// 只在沒有選取文本時才觸發單行點擊
			const selection = window.getSelection();
			if (selection && !selection.isCollapsed) {
				return;
			}
			
			const pseudoLineNum = parseInt(this.getAttribute('data-line-number'));
			console.log('Pseudocode line clicked:', pseudoLineNum);
			
			vscode.postMessage({ 
				command: 'webview.pseudocodeLineClicked', 
				pseudocodeLine: pseudoLineNum 
			});
		});
	});
	
	//添加多行選取事件
	pseudocodeContent.addEventListener('mouseup', function(e) {
		
		setTimeout(() => {
			const selection = window.getSelection();
			if (!selection || selection.isCollapsed) {
				return;
			}
			
			const selectedText = selection.toString();
			if (!selectedText.trim()) {
				return;
			}
			
			console.log('=== Pseudocode Selection Debug ===');
			console.log('Selected text:', selectedText);
			
			//計算選取的行號
			const selectedLines = [];
			
			//找到選取範圍的起始和結束元素
			const range = selection.getRangeAt(0);
			const startContainer = range.startContainer;
			const endContainer = range.endContainer;
			
			//找到起始和結束的 pseudocode-line 元素
			let startLine = startContainer.nodeType === 3 ? 
							startContainer.parentElement.closest('.pseudocode-line') : 
							startContainer.closest('.pseudocode-line');
			let endLine = endContainer.nodeType === 3 ? 
						endContainer.parentElement.closest('.pseudocode-line') : 
						endContainer.closest('.pseudocode-line');
			
			if (!startLine || !endLine) {
				console.log('Could not find start or end line elements');
				return;
			}
			
			const startLineNum = parseInt(startLine.getAttribute('data-line-number'));
			const endLineNum = parseInt(endLine.getAttribute('data-line-number'));
			
			console.log('Start line:', startLineNum);
			console.log('End line:', endLineNum);
			
			//確保順序正確
			const minLine = Math.min(startLineNum, endLineNum);
			const maxLine = Math.max(startLineNum, endLineNum);
			
			//收集所有選中的行號
			for (let i = minLine; i <= maxLine; i++) {
				selectedLines.push(i);
			}
			
			console.log('Selected pseudocode lines:', selectedLines);
			
			if (selectedLines.length > 0) {
				console.log('Sending webview.pseudocodeLinesClicked message');
				
				//發送多行選取消息
				vscode.postMessage({
					command: 'webview.pseudocodeLinesClicked',
					pseudocodeLines: selectedLines
				});
			} else {
				console.log('No lines selected');
			}
		}, 10);
	});
	
	console.log('Pseudocode display updated with', lines.length, 'lines');
}

function clearPseudocodeHistory() {
	vscode.postMessage({ command: 'webview.clearPseudocodeHistory' });
	const pseudocodeContent = document.getElementById('pseudocode-content');
	if (pseudocodeContent) {
		pseudocodeContent.innerHTML = '';
	}
}



/* ---------- G) Message bridge (from extension -> webview) ---------- */

// message = {
//     command: 'highlightNodesAndPseudocode',
//     nodeIds: ['node_5', 'node_6'],      
//     pseudocodeLines: [2, 3]              
// }   

function handleMessage(message) {
	if (!message || typeof message.command !== 'string') {
		console.warn('Invalid message payload:', message);
		return;
	}
	console.log('Received message:', message.command);
	
	switch (message.command) {
		case 'highlightNodesAndPseudocode':
			if (Array.isArray(message.nodeIds) && Array.isArray(message.pseudocodeLines)) {
				highlightNodes(message.nodeIds);
				highlightPseudocodeLines(message.pseudocodeLines);
			}
			break;
		case 'highlightNodes':
			if (Array.isArray(message.nodeIds)) {
				highlightNodes(message.nodeIds);
			}
			break;
		case 'clearHighlight':
			clearHighlight();
			clearPseudocodeHighlight();
			break;
		case 'setNodeOrder':
			state.nodeOrder = message.nodeOrder;
			console.log('Updated node order:', state.nodeOrder);
			break;
		case 'updatePseudocode':
			updatePseudocodeDisplay(message.pseudocode);
			break;
		case 'setLineMapping':
			setLineMapping(message.mapping);
			break;
		default:
			console.warn('Unhandled webview message:', message.command);
	}
}

window.addEventListener('message', event => handleMessage(event.data));
