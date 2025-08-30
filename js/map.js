import { CONFIG } from './config.js';

export class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.mapTexture = null;
        this.mapMesh = null;
        this.carIndicator = document.getElementById('carIndicator');
        this.currentScale = 0.5;
        this.baseSize = { width: 250, height: 150 };
        
        this.init();
    }
    
    async init() {
        await this.loadMapTexture();
        this.createMapGround();
    }
    
    loadMapTexture() {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();

            const onLoaded = (tex, label) => {
                tex.encoding = THREE.sRGBEncoding;
                tex.anisotropy = 4;
                this.mapTexture = tex;
                console.log(`Map texture loaded successfully (${label})`);
                resolve();
            };

            // まず assets/ を試し、失敗したら Asset/ をフォールバック
            const tex1 = textureLoader.load(
                'assets/FSWMap.jpg',
                (tex) => onLoaded(tex, 'assets/') ,
                undefined,
                () => {
                    console.warn('assets/FSWMap.jpg の読み込みに失敗。Asset/ へフォールバック');
                    const tex2 = textureLoader.load(
                        'Asset/FSWMap.jpg',
                        (tex) => onLoaded(tex, 'Asset/'),
                        undefined,
                        (err) => {
                            console.error('Map texture load failed (both paths).', err);
                            reject(err);
                        }
                    );
                    // tex2 は onLoad で反映
                }
            );
            // tex1 は onLoad で反映
        });
    }
    
    createMapGround() {
        const geometry = new THREE.PlaneGeometry(
            this.baseSize.width * this.currentScale, 
            this.baseSize.height * this.currentScale
        );
        const material = new THREE.MeshStandardMaterial({
            map: this.mapTexture,
            side: THREE.DoubleSide
        });
        
        this.mapMesh = new THREE.Mesh(geometry, material);
        this.mapMesh.rotation.x = -Math.PI / 2;
        this.mapMesh.position.y = 0;
        this.mapMesh.receiveShadow = true;
        
        this.scene.add(this.mapMesh);
    }
    
    updateCarIndicator(vehiclePosition) {
        const mapWidth = 300;
        const mapHeight = 200;
        
        const halfWidth = this.baseSize.width * this.currentScale / 2;
        const halfHeight = this.baseSize.height * this.currentScale / 2;
        
        const normalizedX = (vehiclePosition.x + halfWidth) / (halfWidth * 2);
        const normalizedZ = (vehiclePosition.z + halfHeight) / (halfHeight * 2);
        
        const indicatorX = normalizedX * mapWidth;
        const indicatorY = normalizedZ * mapHeight;
        
        this.carIndicator.style.left = `${indicatorX}px`;
        this.carIndicator.style.top = `${indicatorY}px`;
    }
    
    checkBounds(position) {
        const margin = CONFIG.MAP.COLLISION_MARGIN;
        const halfWidth = this.baseSize.width * this.currentScale / 2;
        const halfHeight = this.baseSize.height * this.currentScale / 2;
        
        if (position.x < -halfWidth + margin || 
            position.x > halfWidth - margin ||
            position.z < -halfHeight + margin || 
            position.z > halfHeight - margin) {
            return true;
        }
        return false;
    }
    
    updateMapSize(scale) {
        this.currentScale = scale;
        
        if (this.mapMesh) {
            this.scene.remove(this.mapMesh);
            this.mapMesh.geometry.dispose();
            
            const geometry = new THREE.PlaneGeometry(
                this.baseSize.width * this.currentScale,
                this.baseSize.height * this.currentScale
            );
            
            this.mapMesh.geometry = geometry;
            this.scene.add(this.mapMesh);
        }
    }
}
