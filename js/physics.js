import { CONFIG } from './config.js';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.init();
    }
    
    init() {
        this.world.gravity.set(0, CONFIG.PHYSICS.GRAVITY, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        this.world.defaultContactMaterial.contactEquationStiffness = 1e8;
        this.world.defaultContactMaterial.contactEquationRelaxation = 4;
        
        const groundMaterial = new CANNON.Material('ground');
        const wheelMaterial = new CANNON.Material('wheel');
        
        const wheelGroundContactMaterial = new CANNON.ContactMaterial(
            wheelMaterial,
            groundMaterial,
            {
                friction: 0.4,
                restitution: 0.3,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 4
            }
        );
        
        this.world.addContactMaterial(wheelGroundContactMaterial);
        
        this.createGround(groundMaterial);
    }
    
    createGround(groundMaterial) {
        // Boxを使用（より安定した地面）
        const groundSize = 300; // マップサイズより大きめ
        const groundThickness = 1;
        const groundShape = new CANNON.Box(new CANNON.Vec3(groundSize/2, groundThickness/2, groundSize/2));
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: groundShape,
            material: groundMaterial,
            type: CANNON.Body.STATIC  // 明示的に静的ボディとして設定
        });
        
        // 地面の位置を設定（上面がY=0になるように）
        groundBody.position.set(0, -groundThickness/2, 0);
        
        this.world.addBody(groundBody);
        
        console.log('物理地面を作成: 300x300のBoxを使用');
        
        // デバッグ：地面の状態を確認
        console.log('Ground body details:', {
            position: groundBody.position,
            size: { x: groundSize, y: groundThickness, z: groundSize },
            type: groundBody.type,
            mass: groundBody.mass
        });
    }
    
    update(deltaTime) {
        this.world.step(CONFIG.PHYSICS.TIME_STEP, deltaTime, CONFIG.PHYSICS.MAX_SUB_STEPS);
    }
    
    addBody(body) {
        this.world.addBody(body);
    }
    
    removeBody(body) {
        this.world.removeBody(body);
    }
}