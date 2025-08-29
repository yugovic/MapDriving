import { ASSETS_CONFIG } from './assets-config.js';

class EnhancedAssetEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 基本設定
        this.selectedAssetType = null;
        this.assets = [];
        this.scale = 0.5;
        this.baseMapSize = { width: 250, height: 150 };
        this.pixelsPerMeter = 4;
        this.showGrid = true;
        this.gridSnap = true;
        this.gridSize = 5; // 5メートル単位
        
        // マップ画像
        this.mapImage = new Image();
        this.mapImageLoaded = false;
        
        // 選択システム
        this.selectedAssets = new Set();
        this.hoveredAsset = null;
        
        // ドラッグシステム
        this.isDragging = false;
        this.dragStart = null;
        this.dragOffset = { x: 0, z: 0 };
        this.isBoxSelecting = false;
        this.boxSelectStart = null;
        
        // 回転システム
        this.isRotating = false;
        this.rotateStart = null;
        
        // 履歴管理
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        // クリップボード
        this.clipboard = [];
        
        // マウス位置
        this.mousePos = { x: 0, y: 0 };
        this.mouseWorldPos = { x: 0, z: 0 };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadMapImage();
        this.loadExistingAssets();
        this.saveHistory();
        this.render();
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }
    
    loadMapImage() {
        this.mapImage.src = 'Asset/FSWMap.jpg';
        this.mapImage.onload = () => {
            this.mapImageLoaded = true;
            this.render();
        };
    }
    
    loadExistingAssets() {
        console.log('=== エディター: 既存アセット読み込み ===');
        
        // まずlocalStorageをチェック
        try {
            const saved = localStorage.getItem('mapDrivingAssets');
            if (saved) {
                const config = JSON.parse(saved);
                console.log('localStorageから設定を読み込みました:', config);
                
                if (config.cones) {
                    config.cones.forEach(pos => {
                        this.assets.push({
                            type: 'cone',
                            x: pos.x,
                            z: pos.z,
                            rotation: pos.rotation || 0,
                            id: this.generateId()
                        });
                    });
                }
                
                if (config.tireBarriers) {
                    config.tireBarriers.forEach(pos => {
                        this.assets.push({
                            type: 'tire',
                            x: pos.x,
                            z: pos.z,
                            rotation: pos.rotation || 0,
                            id: this.generateId()
                        });
                    });
                }
                
                if (config.scale) {
                    this.scale = config.scale;
                    document.getElementById('mapScale').value = this.scale;
                    document.getElementById('scale-value').textContent = `${this.scale.toFixed(2)}x`;
                }
                
                console.log('localStorageから読み込んだアセット数:', this.assets.length);
                this.updateAssetList();
                return;
            }
        } catch (e) {
            console.error('localStorageからの読み込みエラー:', e);
        }
        
        // localStorageがない場合はデフォルト設定を使用
        console.log('localStorageに設定がないため、デフォルト設定を使用します');
        
        ASSETS_CONFIG.cones.forEach(pos => {
            this.assets.push({
                type: 'cone',
                x: pos.x,
                z: pos.z,
                rotation: 0,
                id: this.generateId()
            });
        });
        
        ASSETS_CONFIG.tireBarriers.forEach(pos => {
            this.assets.push({
                type: 'tire',
                x: pos.x,
                z: pos.z,
                rotation: 0,
                id: this.generateId()
            });
        });
        
        // 積み重ねキューブの読み込み
        if (ASSETS_CONFIG.cubeStacks) {
            ASSETS_CONFIG.cubeStacks.forEach(stack => {
                this.assets.push({
                    type: 'cubeStack',
                    x: stack.x,
                    z: stack.z,
                    rotation: 0,
                    count: stack.count || 3,
                    id: this.generateId()
                });
            });
        }
        
        // 3Dオブジェクトの読み込み
        if (ASSETS_CONFIG.objects3d) {
            ASSETS_CONFIG.objects3d.forEach(obj => {
                this.assets.push({
                    type: 'object3d',
                    subType: obj.type,
                    x: obj.x,
                    z: obj.z,
                    rotation: obj.rotation || 0,
                    id: this.generateId()
                });
            });
        }
        
        console.log('デフォルト設定から読み込んだアセット数:', this.assets.length);
        this.updateAssetList();
    }
    
    generateId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    setupEventListeners() {
        // アセットタイプ選択
        document.querySelectorAll('.asset-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.asset-button').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedAssetType = btn.dataset.type;
                // 3Dオブジェクトの場合、サブタイプも保存
                if (btn.dataset.type === 'object3d') {
                    this.selectedSubtype = btn.dataset.subtype;
                }
                this.selectedAssets.clear();
                this.render();
            });
        });
        
        // マウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // キーボードイベント
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // UI コントロール
        this.setupUIControls();
    }
    
    setupUIControls() {
        // スケール変更
        const scaleSlider = document.getElementById('mapScale');
        scaleSlider.addEventListener('input', (e) => {
            this.scale = parseFloat(e.target.value);
            document.getElementById('scale-value').textContent = `${this.scale.toFixed(2)}x`;
            this.render();
        });
        
        // グリッド表示
        document.getElementById('gridToggle').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
        
        // グリッドスナップ
        const snapToggle = document.getElementById('snapToggle');
        if (snapToggle) {
            snapToggle.addEventListener('change', (e) => {
                this.gridSnap = e.target.checked;
            });
        }
        
        // ボタン
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn')?.addEventListener('click', () => this.redo());
        document.getElementById('applyBtn').addEventListener('click', () => this.applyToGame());
        document.getElementById('exportBtn').addEventListener('click', () => this.export());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file').addEventListener('change', (e) => this.import(e));
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.screenToWorld(x, y);
        
        if (e.button === 0) { // 左クリック
            const clickedAsset = this.getAssetAt(worldPos.x, worldPos.z);
            
            if (clickedAsset) {
                if (e.shiftKey) {
                    // Shift+クリックで複数選択
                    if (this.selectedAssets.has(clickedAsset.id)) {
                        this.selectedAssets.delete(clickedAsset.id);
                    } else {
                        this.selectedAssets.add(clickedAsset.id);
                    }
                } else if (!this.selectedAssets.has(clickedAsset.id)) {
                    // 単体選択
                    this.selectedAssets.clear();
                    this.selectedAssets.add(clickedAsset.id);
                }
                
                // ドラッグ開始
                this.isDragging = true;
                this.dragStart = { x: worldPos.x, z: worldPos.z };
                const asset = this.assets.find(a => a.id === clickedAsset.id);
                this.dragOffset = {
                    x: asset.x - worldPos.x,
                    z: asset.z - worldPos.z
                };
            } else {
                // 空白をクリック
                if (!e.shiftKey) {
                    this.selectedAssets.clear();
                }
                
                if (this.selectedAssetType) {
                    // 新規配置
                    this.placeAsset(worldPos.x, worldPos.z);
                } else {
                    // ボックス選択開始
                    this.isBoxSelecting = true;
                    this.boxSelectStart = { x, y };
                }
            }
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.mousePos = { x, y };
        
        const worldPos = this.screenToWorld(x, y);
        this.mouseWorldPos = worldPos;
        
        // ホバー検出
        const prevHovered = this.hoveredAsset;
        this.hoveredAsset = this.getAssetAt(worldPos.x, worldPos.z);
        
        if (this.isDragging && this.selectedAssets.size > 0) {
            // ドラッグ中
            const deltaX = worldPos.x - this.dragStart.x;
            const deltaZ = worldPos.z - this.dragStart.z;
            
            this.selectedAssets.forEach(id => {
                const asset = this.assets.find(a => a.id === id);
                if (asset) {
                    let newX = asset.x + deltaX;
                    let newZ = asset.z + deltaZ;
                    
                    if (this.gridSnap) {
                        newX = Math.round(newX / this.gridSize) * this.gridSize;
                        newZ = Math.round(newZ / this.gridSize) * this.gridSize;
                    }
                    
                    asset.x = newX;
                    asset.z = newZ;
                }
            });
            
            this.dragStart = worldPos;
        }
        
        // カーソル変更
        if (this.hoveredAsset || this.isDragging) {
            this.canvas.style.cursor = 'pointer';
        } else if (this.isBoxSelecting) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = this.selectedAssetType ? 'crosshair' : 'default';
        }
        
        // 座標表示更新
        document.getElementById('mousePos').textContent = 
            `X: ${Math.round(worldPos.x)}, Z: ${Math.round(worldPos.z)}`;
        
        this.render();
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.saveHistory();
        }
        
        if (this.isBoxSelecting) {
            this.performBoxSelection();
            this.isBoxSelecting = false;
            this.boxSelectStart = null;
        }
        
        this.render();
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey && this.selectedAssets.size > 0) {
            // Ctrl+ホイールで回転
            const rotationDelta = e.deltaY > 0 ? 15 : -15;
            
            this.selectedAssets.forEach(id => {
                const asset = this.assets.find(a => a.id === id);
                if (asset) {
                    asset.rotation = (asset.rotation || 0) + rotationDelta;
                    asset.rotation = asset.rotation % 360;
                }
            });
            
            this.saveHistory();
            this.render();
        }
    }
    
    handleKeyDown(e) {
        // Ctrl+A: 全選択
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this.assets.forEach(asset => this.selectedAssets.add(asset.id));
            this.render();
        }
        
        // Ctrl+C: コピー
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            this.copy();
        }
        
        // Ctrl+V: ペースト
        if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            this.paste();
        }
        
        // Ctrl+X: カット
        if (e.ctrlKey && e.key === 'x') {
            e.preventDefault();
            this.cut();
        }
        
        // Ctrl+Z: 元に戻す
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        
        // Ctrl+Shift+Z: やり直し
        if (e.ctrlKey && e.shiftKey && e.key === 'z') {
            e.preventDefault();
            this.redo();
        }
        
        // Delete: 削除
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelected();
        }
        
        // Ctrl+D: 複製
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            this.duplicate();
        }
        
        // R: 回転モード
        if (e.key === 'r' && this.selectedAssets.size > 0) {
            e.preventDefault();
            this.rotateSelected(e.shiftKey ? -15 : 15);
        }
        
        // +/-: 積み重ねキューブの数を調整
        if ((e.key === '+' || e.key === '=') && this.selectedAssets.size > 0) {
            this.adjustCubeStackCount(1);
        }
        if (e.key === '-' && this.selectedAssets.size > 0) {
            this.adjustCubeStackCount(-1);
        }
    }
    
    handleKeyUp(e) {
        // キーアップ処理（必要に応じて）
    }
    
    getAssetAt(x, z) {
        // 逆順で検索（上に描画されているものを優先）
        for (let i = this.assets.length - 1; i >= 0; i--) {
            const asset = this.assets[i];
            const distance = Math.sqrt(
                Math.pow(asset.x - x, 2) + Math.pow(asset.z - z, 2)
            );
            
            const hitRadius = asset.type === 'tire' ? 5 : 3;
            if (distance <= hitRadius) {
                return asset;
            }
        }
        return null;
    }
    
    placeAsset(x, z) {
        if (this.gridSnap) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            z = Math.round(z / this.gridSize) * this.gridSize;
        }
        
        const newAsset = {
            type: this.selectedAssetType,
            x: x,
            z: z,
            rotation: 0,
            id: this.generateId()
        };
        
        // 積み重ねキューブの場合、デフォルトの積み重ね数を設定
        if (this.selectedAssetType === 'cubeStack') {
            newAsset.count = 3; // デフォルトで3個
        }
        
        // 3Dオブジェクトの場合、サブタイプを設定
        if (this.selectedAssetType === 'object3d') {
            newAsset.subtype = this.selectedSubtype;
        }
        
        this.assets.push(newAsset);
        this.selectedAssets.clear();
        this.selectedAssets.add(newAsset.id);
        
        this.updateAssetList();
        this.saveHistory();
        this.render();
    }
    
    performBoxSelection() {
        if (!this.boxSelectStart) return;
        
        const start = this.boxSelectStart;
        const end = this.mousePos;
        
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        
        this.assets.forEach(asset => {
            const pos = this.worldToScreen(asset.x, asset.z);
            if (pos.x >= minX && pos.x <= maxX && 
                pos.y >= minY && pos.y <= maxY) {
                this.selectedAssets.add(asset.id);
            }
        });
    }
    
    copy() {
        this.clipboard = [];
        this.selectedAssets.forEach(id => {
            const asset = this.assets.find(a => a.id === id);
            if (asset) {
                this.clipboard.push({...asset});
            }
        });
    }
    
    paste() {
        if (this.clipboard.length === 0) return;
        
        this.selectedAssets.clear();
        
        const offset = 10; // ペースト時のオフセット
        this.clipboard.forEach(asset => {
            const newAsset = {
                ...asset,
                x: asset.x + offset,
                z: asset.z + offset,
                id: this.generateId()
            };
            this.assets.push(newAsset);
            this.selectedAssets.add(newAsset.id);
        });
        
        this.updateAssetList();
        this.saveHistory();
        this.render();
    }
    
    cut() {
        this.copy();
        this.deleteSelected();
    }
    
    duplicate() {
        const touplicate = [];
        this.selectedAssets.forEach(id => {
            const asset = this.assets.find(a => a.id === id);
            if (asset) {
                touplicate.push({...asset});
            }
        });
        
        this.selectedAssets.clear();
        
        touplicate.forEach(asset => {
            const newAsset = {
                ...asset,
                x: asset.x + 5,
                z: asset.z + 5,
                id: this.generateId()
            };
            this.assets.push(newAsset);
            this.selectedAssets.add(newAsset.id);
        });
        
        this.updateAssetList();
        this.saveHistory();
        this.render();
    }
    
    deleteSelected() {
        if (this.selectedAssets.size === 0) return;
        
        this.assets = this.assets.filter(asset => 
            !this.selectedAssets.has(asset.id)
        );
        
        this.selectedAssets.clear();
        this.updateAssetList();
        this.saveHistory();
        this.render();
    }
    
    rotateSelected(angle) {
        this.selectedAssets.forEach(id => {
            const asset = this.assets.find(a => a.id === id);
            if (asset) {
                asset.rotation = ((asset.rotation || 0) + angle) % 360;
            }
        });
        
        this.saveHistory();
        this.render();
    }
    
    saveHistory() {
        // 現在の位置より後の履歴を削除
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // 新しい状態を追加
        this.history.push({
            assets: JSON.parse(JSON.stringify(this.assets)),
            timestamp: Date.now()
        });
        
        // 履歴の最大数を超えたら古いものを削除
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.assets = JSON.parse(JSON.stringify(state.assets));
            this.selectedAssets.clear();
            this.updateAssetList();
            this.updateUndoRedoButtons();
            this.render();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.assets = JSON.parse(JSON.stringify(state.assets));
            this.selectedAssets.clear();
            this.updateAssetList();
            this.updateUndoRedoButtons();
            this.render();
        }
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
        }
    }
    
    screenToWorld(screenX, screenY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        const worldX = (screenX - centerX) / this.pixelsPerMeter;
        const worldZ = (screenY - centerY) / this.pixelsPerMeter;
        
        return { x: worldX, z: worldZ };
    }
    
    worldToScreen(worldX, worldZ) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        const screenX = centerX + worldX * this.pixelsPerMeter;
        const screenY = centerY + worldZ * this.pixelsPerMeter;
        
        return { x: screenX, y: screenY };
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 背景
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // マップ画像
        if (this.mapImageLoaded) {
            this.drawMap();
        }
        
        // グリッド
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // マップ境界
        this.drawMapBounds();
        
        // アセット
        this.drawAssets();
        
        // 選択ボックス
        if (this.isBoxSelecting && this.boxSelectStart) {
            this.drawSelectionBox();
        }
        
        // プレビュー
        if (this.selectedAssetType && !this.isDragging && !this.isBoxSelecting) {
            this.drawPreview();
        }
        
        // 選択情報
        this.updateSelectionInfo();
    }
    
    drawMap() {
        const mapWidth = this.baseMapSize.width * this.scale * this.pixelsPerMeter;
        const mapHeight = this.baseMapSize.height * this.scale * this.pixelsPerMeter;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.drawImage(
            this.mapImage,
            centerX - mapWidth / 2,
            centerY - mapHeight / 2,
            mapWidth,
            mapHeight
        );
        this.ctx.restore();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 0.5;
        
        const gridSize = this.gridSize * this.pixelsPerMeter;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // グリッド線
        for (let x = centerX % gridSize; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = centerY % gridSize; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        // 中心線
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();
    }
    
    drawMapBounds() {
        const width = this.baseMapSize.width * this.scale * this.pixelsPerMeter;
        const height = this.baseMapSize.height * this.scale * this.pixelsPerMeter;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            centerX - width / 2,
            centerY - height / 2,
            width,
            height
        );
    }
    
    drawAssets() {
        this.assets.forEach(asset => {
            const pos = this.worldToScreen(asset.x, asset.z);
            const isSelected = this.selectedAssets.has(asset.id);
            const isHovered = this.hoveredAsset && this.hoveredAsset.id === asset.id;
            
            this.ctx.save();
            
            // 回転適用
            if (asset.rotation) {
                this.ctx.translate(pos.x, pos.y);
                this.ctx.rotate((asset.rotation * Math.PI) / 180);
                this.ctx.translate(-pos.x, -pos.y);
            }
            
            if (asset.type === 'cone') {
                this.drawCone(pos.x, pos.y, isSelected, isHovered);
            } else if (asset.type === 'tire') {
                this.drawTire(pos.x, pos.y, isSelected, isHovered);
            } else if (asset.type === 'cubeStack') {
                this.drawCubeStack(pos.x, pos.y, asset.count || 3, isSelected, isHovered);
            } else if (asset.type === 'object3d') {
                this.draw3DObject(pos.x, pos.y, asset.subType, isSelected, isHovered);
            }
            
            // 選択ハンドル
            if (isSelected) {
                this.drawSelectionHandles(pos.x, pos.y, asset.type);
            }
            
            this.ctx.restore();
        });
    }
    
    drawCone(x, y, isSelected, isHovered) {
        const radius = 3;
        
        this.ctx.fillStyle = isSelected ? '#ff9944' : '#ff6600';
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = isHovered ? '#ffaa00' : '#ff8800';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.stroke();
    }
    
    drawTire(x, y, isSelected, isHovered) {
        const radius = 5;
        
        this.ctx.fillStyle = isSelected ? '#444' : '#222';
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = isHovered ? '#666' : '#444';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.stroke();
        
        // タイヤの向きを示す線
        this.ctx.beginPath();
        this.ctx.moveTo(x - radius, y);
        this.ctx.lineTo(x + radius, y);
        this.ctx.stroke();
    }
    
    drawCubeStack(x, y, count, isSelected, isHovered) {
        const cubeSize = 6;
        const baseY = y;
        
        // キューブを下から上に描画
        for (let i = 0; i < count; i++) {
            const cubeY = baseY - i * cubeSize * 0.8; // 積み重ね時のオフセット
            
            // キューブの影
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(x - cubeSize/2 + 2, cubeY - cubeSize/2 + 2, cubeSize, cubeSize);
            
            // キューブ本体
            if (isHovered) {
                this.ctx.fillStyle = '#6aa3db';
            } else if (isSelected) {
                this.ctx.fillStyle = '#5599cc';
            } else {
                this.ctx.fillStyle = '#4488cc';
            }
            this.ctx.fillRect(x - cubeSize/2, cubeY - cubeSize/2, cubeSize, cubeSize);
            
            // 枠線
            this.ctx.strokeStyle = isSelected ? '#ff6b6b' : '#336699';
            this.ctx.lineWidth = isSelected ? 2 : 1;
            this.ctx.strokeRect(x - cubeSize/2, cubeY - cubeSize/2, cubeSize, cubeSize);
        }
        
        // 積み重ね数を表示
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(count.toString(), x, y + 10);
    }
    
    draw3DObject(x, y, subType, isSelected, isHovered) {
        const iconSize = 8;
        const icons = {
            'bigRoadSign': { symbol: '⚠', color: '#ffcc00' },
            'newsPaperStand': { symbol: '📰', color: '#999999' },
            'roadBlock': { symbol: '🚧', color: '#ff6600' },
            'toyDuck': { symbol: '🦆', color: '#ffdd00' },
            'tramStop': { symbol: '🚏', color: '#0099ff' },
            'tree': { symbol: '🌳', color: '#228822' }
        };
        
        const icon = icons[subType] || { symbol: '❓', color: '#999999' };
        
        // 背景円
        this.ctx.fillStyle = isSelected ? '#4ecdc4' : (isHovered ? '#666666' : '#444444');
        this.ctx.beginPath();
        this.ctx.arc(x, y, iconSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // アイコン文字
        this.ctx.fillStyle = icon.color;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(icon.symbol, x, y);
        
        // 選択時の枠線
        if (isSelected) {
            this.ctx.strokeStyle = '#ff6b6b';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    drawSelectionHandles(x, y, type) {
        const size = 4;
        this.ctx.fillStyle = '#4ecdc4';
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        
        // 選択ハンドル
        const positions = [
            { x: x - 10, y: y - 10 },
            { x: x + 10, y: y - 10 },
            { x: x - 10, y: y + 10 },
            { x: x + 10, y: y + 10 }
        ];
        
        positions.forEach(pos => {
            this.ctx.fillRect(pos.x - size/2, pos.y - size/2, size, size);
            this.ctx.strokeRect(pos.x - size/2, pos.y - size/2, size, size);
        });
    }
    
    drawSelectionBox() {
        if (!this.boxSelectStart) return;
        
        const start = this.boxSelectStart;
        const end = this.mousePos;
        
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.strokeRect(
            start.x,
            start.y,
            end.x - start.x,
            end.y - start.y
        );
        
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = 'rgba(78, 205, 196, 0.1)';
        this.ctx.fillRect(
            start.x,
            start.y,
            end.x - start.x,
            end.y - start.y
        );
    }
    
    drawPreview() {
        const pos = this.worldToScreen(
            this.gridSnap ? Math.round(this.mouseWorldPos.x / this.gridSize) * this.gridSize : this.mouseWorldPos.x,
            this.gridSnap ? Math.round(this.mouseWorldPos.z / this.gridSize) * this.gridSize : this.mouseWorldPos.z
        );
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        
        if (this.selectedAssetType === 'cone') {
            this.drawCone(pos.x, pos.y, false, false);
        } else if (this.selectedAssetType === 'tire') {
            this.drawTire(pos.x, pos.y, false, false);
        } else if (this.selectedAssetType === 'cubeStack') {
            this.drawCubeStack(pos.x, pos.y, 3, false, false); // プレビューで3個固定
        } else if (this.selectedAssetType && this.selectedAssetType.startsWith('object3d_')) {
            const subType = this.selectedAssetType.replace('object3d_', '');
            this.draw3DObject(pos.x, pos.y, subType, false, false);
        }
        
        this.ctx.restore();
    }
    
    updateSelectionInfo() {
        document.getElementById('assetCount').textContent = this.assets.length;
        
        const selectionInfo = document.getElementById('selectionInfo');
        if (selectionInfo) {
            if (this.selectedAssets.size > 0) {
                selectionInfo.textContent = `選択中: ${this.selectedAssets.size}個`;
            } else {
                selectionInfo.textContent = '';
            }
        }
    }
    
    updateAssetList() {
        const container = document.getElementById('asset-items');
        container.innerHTML = '';
        
        this.assets.forEach((asset, index) => {
            const item = document.createElement('div');
            item.className = 'asset-item';
            if (this.selectedAssets.has(asset.id)) {
                item.classList.add('selected');
            }
            
            const rotation = asset.rotation ? ` (${asset.rotation}°)` : '';
            const countInfo = asset.type === 'cubeStack' ? ` x${asset.count || 3}` : '';
            
            let typeDisplay;
            if (asset.type === 'object3d') {
                const objectNames = {
                    'bigRoadSign': '大きな道路標識',
                    'newsPaperStand': '新聞スタンド',
                    'roadBlock': 'ロードブロック',
                    'toyDuck': 'おもちゃのアヒル',
                    'tramStop': 'トラム停留所',
                    'tree': '木'
                };
                typeDisplay = objectNames[asset.subtype] || '3Dオブジェクト';
            } else if (asset.type === 'cone') {
                typeDisplay = 'コーン';
            } else if (asset.type === 'tire') {
                typeDisplay = 'タイヤバリア';
            } else if (asset.type === 'cubeStack') {
                typeDisplay = `積み重ねキューブ${countInfo}`;
            } else {
                typeDisplay = asset.type;
            }
            
            item.innerHTML = `
                <span>${typeDisplay} (${asset.x}, ${asset.z})${rotation}</span>
                <button class="delete-btn" data-id="${asset.id}">削除</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn')) {
                    if (e.shiftKey) {
                        if (this.selectedAssets.has(asset.id)) {
                            this.selectedAssets.delete(asset.id);
                        } else {
                            this.selectedAssets.add(asset.id);
                        }
                    } else {
                        this.selectedAssets.clear();
                        this.selectedAssets.add(asset.id);
                    }
                    this.updateAssetList();
                    this.render();
                }
            });
            
            container.appendChild(item);
        });
        
        // 削除ボタン
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                this.assets = this.assets.filter(a => a.id !== id);
                this.selectedAssets.delete(id);
                this.updateAssetList();
                this.saveHistory();
                this.render();
            });
        });
    }
    
    clearAll() {
        if (confirm('すべてのアセットを削除しますか？')) {
            this.assets = [];
            this.selectedAssets.clear();
            this.updateAssetList();
            this.saveHistory();
            this.render();
        }
    }
    
    adjustCubeStackCount(delta) {
        let hasChanged = false;
        
        this.selectedAssets.forEach(id => {
            const asset = this.assets.find(a => a.id === id);
            if (asset && asset.type === 'cubeStack') {
                const newCount = Math.max(1, Math.min(10, (asset.count || 3) + delta));
                if (newCount !== asset.count) {
                    asset.count = newCount;
                    hasChanged = true;
                }
            }
        });
        
        if (hasChanged) {
            this.saveHistory();
            this.render();
            this.updateAssetList();
        }
    }
    
    applyToGame() {
        const config = {
            scale: this.scale,
            cones: this.assets.filter(a => a.type === 'cone').map(a => ({ 
                x: a.x, 
                z: a.z,
                rotation: a.rotation || 0
            })),
            tireBarriers: this.assets.filter(a => a.type === 'tire').map(a => ({ 
                x: a.x, 
                z: a.z,
                rotation: a.rotation || 0
            })),
            cubeStacks: this.assets.filter(a => a.type === 'cubeStack').map(a => ({ 
                x: a.x, 
                z: a.z,
                rotation: a.rotation || 0,
                count: a.count || 3
            })),
            objects3d: this.assets.filter(a => a.type === 'object3d').map(a => ({ 
                x: a.x, 
                z: a.z,
                rotation: a.rotation || 0,
                type: a.subtype
            })),
            timestamp: Date.now()
        };
        
        console.log('=== エディター: ゲームに適用 ===');
        console.log('適用する設定:', config);
        console.log('コーン数:', config.cones.length);
        console.log('タイヤバリア数:', config.tireBarriers.length);
        console.log('積み重ねキューブ数:', config.cubeStacks ? config.cubeStacks.length : 0);
        
        // localStorageに保存
        try {
            const jsonString = JSON.stringify(config);
            localStorage.setItem('mapDrivingAssets', jsonString);
            console.log('localStorageに保存しました');
            console.log('保存したデータの長さ:', jsonString.length);
            
            // 保存後の確認
            const verification = localStorage.getItem('mapDrivingAssets');
            console.log('保存後の確認:', verification ? '成功' : '失敗');
            if (verification) {
                const parsed = JSON.parse(verification);
                console.log('保存されたデータ:', parsed);
            }
        } catch (e) {
            console.error('localStorageへの保存エラー:', e);
        }
        
        // 成功メッセージ表示
        const applyBtn = document.getElementById('applyBtn');
        const originalText = applyBtn.textContent;
        applyBtn.textContent = '適用しました！';
        applyBtn.style.backgroundColor = '#4ecdc4';
        
        setTimeout(() => {
            applyBtn.textContent = originalText;
            applyBtn.style.backgroundColor = '#ff6b6b';
        }, 2000);
        
        console.log('=== エディター: 適用完了 ===');
    }
    
    export() {
        const config = {
            scale: this.scale,
            cones: this.assets.filter(a => a.type === 'cone').map(a => ({ 
                x: a.x, 
                z: a.z,
                rotation: a.rotation || 0
            })),
            tireBarriers: this.assets.filter(a => a.type === 'tire').map(a => ({ 
                x: a.x, 
                z: a.z,
                rotation: a.rotation || 0
            }))
        };
        
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'asset-config.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    import(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                this.assets = [];
                this.selectedAssets.clear();
                
                if (config.cones) {
                    config.cones.forEach(pos => {
                        this.assets.push({
                            type: 'cone',
                            x: pos.x,
                            z: pos.z,
                            rotation: pos.rotation || 0,
                            id: this.generateId()
                        });
                    });
                }
                
                if (config.tireBarriers) {
                    config.tireBarriers.forEach(pos => {
                        this.assets.push({
                            type: 'tire',
                            x: pos.x,
                            z: pos.z,
                            rotation: pos.rotation || 0,
                            id: this.generateId()
                        });
                    });
                }
                
                if (config.scale) {
                    this.scale = config.scale;
                    document.getElementById('mapScale').value = this.scale;
                    document.getElementById('scale-value').textContent = `${this.scale.toFixed(2)}x`;
                }
                
                this.updateAssetList();
                this.saveHistory();
                this.render();
            } catch (err) {
                alert('ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    }
}

// エディター起動
window.addEventListener('DOMContentLoaded', () => {
    new EnhancedAssetEditor();
});