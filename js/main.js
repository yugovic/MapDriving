import { CONFIG } from './config.js';
import { SceneManager } from './scene.js';
import { PhysicsWorld } from './physics.js';
import { Vehicle } from './vehicle.js';
import { MapManager } from './map.js';
import { InputManager } from './input.js';
import { AssetsManager } from './assets.js';

class Game {
    constructor() {
        this.sceneManager = null;
        this.physicsWorld = null;
        this.vehicle = null;
        this.mapManager = null;
        this.inputManager = null;
        this.assetsManager = null;
        this.clock = new THREE.Clock();
        
        this.init();
    }
    
    init() {
        this.sceneManager = new SceneManager();
        this.physicsWorld = new PhysicsWorld();
        this.mapManager = new MapManager(this.sceneManager.scene);
        this.inputManager = new InputManager();
        this.assetsManager = new AssetsManager(this.sceneManager.scene, this.physicsWorld);
        
        this.vehicle = new Vehicle(
            this.sceneManager.scene,
            this.physicsWorld,
            { x: 0, y: 2, z: 0 }
        );
        
        this.setupDebugMenu();
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        const input = this.inputManager.getInput();
        this.vehicle.update(input);
        
        this.physicsWorld.update(deltaTime);
        
        // アセットの物理更新
        this.assetsManager.update();
        
        const vehiclePosition = this.vehicle.getPosition();
        
        if (this.mapManager.checkBounds(vehiclePosition)) {
            this.vehicle.resetPosition({ x: 0, y: 2, z: 0 });
        }
        
        if (this.vehicle.chassisBody) {
            const adjustments = this.sceneManager.camera.userData.adjustments || CONFIG.CAMERA.ADJUSTMENTS;
            this.sceneManager.updateCameraPosition(this.vehicle.chassisBody, adjustments);
        }
        
        this.mapManager.updateCarIndicator(vehiclePosition);
        
        this.updateSpeedometer(this.vehicle.getSpeed());
        
        this.sceneManager.render();
    }
    
    updateSpeedometer(speed) {
        const speedElement = document.getElementById('speedValue');
        speedElement.textContent = Math.round(speed);
    }
    
    setupDebugMenu() {
        const debugModal = document.getElementById('debugModal');
        const mapSizeSlider = document.getElementById('mapSizeSlider');
        const mapSizeValue = document.getElementById('mapSizeValue');
        const closeDebugBtn = document.getElementById('closeDebug');
        const reloadBtn = document.getElementById('reloadBtn');
        
        this.inputManager.setDebugCallback(() => {
            debugModal.style.display = debugModal.style.display === 'block' ? 'none' : 'block';
        });
        
        mapSizeSlider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            mapSizeValue.textContent = `${scale.toFixed(2)}x`;
            this.mapManager.updateMapSize(scale);
            this.assetsManager.updateScale(scale);
        });
        
        closeDebugBtn.addEventListener('click', () => {
            debugModal.style.display = 'none';
        });
        
        debugModal.addEventListener('click', (e) => {
            if (e.target === debugModal) {
                debugModal.style.display = 'none';
            }
        });
        
        // エディターから再読み込みボタン
        reloadBtn.addEventListener('click', () => {
            this.assetsManager.reloadFromEditor();
            
            // ボタンの表示を一時的に変更
            const originalText = reloadBtn.textContent;
            reloadBtn.textContent = '再読み込みしました！';
            reloadBtn.style.backgroundColor = '#ff6b6b';
            
            setTimeout(() => {
                reloadBtn.textContent = originalText;
                reloadBtn.style.backgroundColor = '#4ecdc4';
            }, 2000);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});