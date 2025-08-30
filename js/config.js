export const CONFIG = {
    VEHICLE: {
        MASS: 500,
        MAX_SPEED: 72,
        ENGINE_FORCE: 1400,
        TURBO_MULTIPLIER: 3,
        BRAKE_FORCE: 35,
        STEERING_INCREMENT: 0.1,
        MAX_STEERING_VALUE: 1.0,
        WHEEL_RADIUS: 0.3,
        WHEEL_WIDTH: 0.25,
        WHEEL_SUSPENSION_STIFFNESS: 100,
        WHEEL_SUSPENSION_DAMPING: 8,
        WHEEL_SUSPENSION_COMPRESSION: 4.4,
        WHEEL_SUSPENSION_REST_LENGTH: 0.4,
        WHEEL_MAX_SUSPENSION_TRAVEL: 0.4,
        WHEEL_MAX_SUSPENSION_FORCE: 100000,
        WHEEL_FRICTION_SLIP: 8,
        WHEEL_FRONT_FRICTION_SLIP: 20,
        WHEEL_REAR_FRICTION_SLIP: 2,
        CHASSIS_SIZE: { x: 1.3, y: 0.75, z: 2.8 },
        STABILIZATION: {
            ANGULAR_DAMPING: 0.4,
            LINEAR_DAMPING: 0.1,
            DOWN_FORCE: 100
        }
    },
    
    // 見た目調整（物理には影響しない）
    VISUAL: {
        // 車体の最下点と地面の目標クリアランス（m）。描画のみの調整。
        TARGET_CLEARANCE: 0.04,
        // ドロップシャドウの不透明度
        SHADOW_OPACITY: 0.5
    },
    
    MAP: {
        SCALE: 0.5,
        BOUNDS: {
            MIN_X: -125,
            MAX_X: 125,
            MIN_Z: -75,
            MAX_Z: 75
        },
        COLLISION_MARGIN: 10
    },
    
    CAMERA: {
        FOV: 50,
        NEAR: 0.1,
        FAR: 1000,
        INITIAL_POSITION: { x: -15, y: 15, z: 15 },
        ADJUSTMENTS: {
            DISTANCE: 15,
            HEIGHT: 10,
            SIDE_OFFSET: 0,
            FOLLOW_FACTOR: 0.1
        },
        FOLLOW_MODE: {
            DISTANCE: 8,
            HEIGHT: 3,
            LOOK_AT_HEIGHT: 1,
            SMOOTHNESS: 0.1
        }
    },
    
    PHYSICS: {
        GRAVITY: -20,
        TIME_STEP: 1/60,
        MAX_SUB_STEPS: 3
    },
    
    GRAPHICS: {
        SHADOW_MAP_SIZE: 2048,
        ANTIALIAS: true
    }
};
