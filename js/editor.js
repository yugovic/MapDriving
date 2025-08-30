import { ASSETS_CONFIG } from './assets-config.js';

class AssetEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.selectedAssetType = null;
        this.assets = [];
        this.scale = 0.5;
        this.baseMapSize = { width: 250, height: 150 };
        this.pixelsPerMeter = 4;
        this.showGrid = true;
        this.mapImage = new Image();
        this.mapImageLoaded = false;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadMapImage();
        this.loadExistingAssets();
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
        // まず assets/ を試し、失敗したら Asset/ にフォールバック
        this.mapImage.onerror = () => {
            this.mapImage.onerror = null;
            this.mapImage.src = 'Asset/FSWMap.jpg';
        };
        this.mapImage.src = 'assets/FSWMap.jpg';
        this.mapImage.onload = () => {
            this.mapImageLoaded = true;
            this.render();
        };
    }
    
    loadExistingAssets() {
        // 既存の設定から読み込み
        ASSETS_CONFIG.cones.forEach(pos => {
            this.assets.push({
                type: 'cone',
                x: pos.x,
                z: pos.z,
                id: Date.now() + Math.random()
            });
        });
        
        ASSETS_CONFIG.tireBarriers.forEach(pos => {
            this.assets.push({
                type: 'tire',
                x: pos.x,
                z: pos.z,
                id: Date.now() + Math.random()
            });
        });
        
        this.updateAssetList();
    }
    
    setupEventListeners() {
        // アセットタイプ選択
        document.querySelectorAll('.asset-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.asset-button').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedAssetType = btn.dataset.type;
            });
        });
        
        // キャンバスクリック
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // スケール変更
        const scaleSlider = document.getElementById('mapScale');
        scaleSlider.addEventListener('input', (e) => {
            this.scale = parseFloat(e.target.value);
            document.getElementById('scale-value').textContent = `${this.scale.toFixed(2)}x`;
            this.render();
        });
        
        // グリッド表示切り替え
        document.getElementById('gridToggle').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
        
        // コントロールボタン
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('exportBtn').addEventListener('click', () => this.export());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file').addEventListener('change', (e) => this.import(e));
    }
    
    handleCanvasClick(e) {
        if (!this.selectedAssetType) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const worldPos = this.screenToWorld(x, y);
        
        this.assets.push({
            type: this.selectedAssetType,
            x: Math.round(worldPos.x),
            z: Math.round(worldPos.z),
            id: Date.now() + Math.random()
        });
        
        this.updateAssetList();
        this.render();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const worldPos = this.screenToWorld(x, y);
        document.getElementById('mousePos').textContent = `X: ${Math.round(worldPos.x)}, Z: ${Math.round(worldPos.z)}`;
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
        
        // マップ画像を描画
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
        
        // プレビュー
        if (this.selectedAssetType) {
            this.drawPreview();
        }
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
        
        const gridSize = 10 * this.pixelsPerMeter; // 10メートルグリッド
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // 縦線
        for (let x = centerX % gridSize; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 横線
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
            
            this.ctx.save();
            
            if (asset.type === 'cone') {
                // コーン
                this.ctx.fillStyle = '#ff6600';
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#ff8800';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else if (asset.type === 'tire') {
                // タイヤ
                this.ctx.fillStyle = '#222';
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.strokeStyle = '#444';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else if (asset.type === 'start-line') {
                // スタートライン
                this.ctx.fillStyle = '#fff';
                this.ctx.fillRect(pos.x - 20, pos.y - 2, 40, 4);
            }
            
            this.ctx.restore();
        });
    }
    
    drawPreview() {
        // マウス位置にプレビューを表示（実装は省略）
    }
    
    updateAssetList() {
        const container = document.getElementById('asset-items');
        container.innerHTML = '';
        
        this.assets.forEach((asset, index) => {
            const item = document.createElement('div');
            item.className = 'asset-item';
            item.innerHTML = `
                <span>${asset.type} (${asset.x}, ${asset.z})</span>
                <button class="delete-btn" data-index="${index}">削除</button>
            `;
            container.appendChild(item);
        });
        
        // 削除ボタンのイベント
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.assets.splice(index, 1);
                this.updateAssetList();
                this.render();
            });
        });
        
        document.getElementById('assetCount').textContent = this.assets.length;
    }
    
    clearAll() {
        if (confirm('すべてのアセットを削除しますか？')) {
            this.assets = [];
            this.updateAssetList();
            this.render();
        }
    }
    
    undo() {
        if (this.assets.length > 0) {
            this.assets.pop();
            this.updateAssetList();
            this.render();
        }
    }
    
    export() {
        const config = {
            scale: this.scale,
            cones: this.assets.filter(a => a.type === 'cone').map(a => ({ x: a.x, z: a.z })),
            tireBarriers: this.assets.filter(a => a.type === 'tire').map(a => ({ x: a.x, z: a.z })),
            customAssets: this.assets.filter(a => !['cone', 'tire'].includes(a.type))
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
                
                if (config.cones) {
                    config.cones.forEach(pos => {
                        this.assets.push({
                            type: 'cone',
                            x: pos.x,
                            z: pos.z,
                            id: Date.now() + Math.random()
                        });
                    });
                }
                
                if (config.tireBarriers) {
                    config.tireBarriers.forEach(pos => {
                        this.assets.push({
                            type: 'tire',
                            x: pos.x,
                            z: pos.z,
                            id: Date.now() + Math.random()
                        });
                    });
                }
                
                if (config.scale) {
                    this.scale = config.scale;
                    document.getElementById('mapScale').value = this.scale;
                    document.getElementById('scale-value').textContent = `${this.scale.toFixed(2)}x`;
                }
                
                this.updateAssetList();
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
    new AssetEditor();
});
