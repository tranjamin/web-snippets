const GRAY_PURPLE = 0x282431;
const LAVENDER = 0x7a6e88;
const PURPLE = 0x583d75;
const BLACK = 0x00;

class Face {
    constructor(properties, name, link) {
        this.face = new THREE.MeshBasicMaterial(properties);
        this.name = name;
        this.link = link
    }

    highlight() {
        this.face.opacity = 1;
        document.body.style.cursor = "pointer";
    }

    unhighlight() {
        this.face.opacity = 0.2;
        document.body.style.cursor = "default";
    }

}

class ColourFace extends Face {
    constructor(colour, name, link, opacity=null) {
        super({
            color: colour, 
            transparent: (opacity == null ? false:true), 
            opacity:opacity, 
            depthWrite: false,
            blending: THREE.NormalBlending
        }, name, link);
    }
}

class ImageFace extends Face {
    static textureLoader = new THREE.TextureLoader();

    constructor(url, name, link, opacity=null) {
        super({
            map: ImageFace.textureLoader.load(url), 
            transparent: (opacity == null ? false:true), 
            opacity:opacity,
            depthWrite: false,
            blending: THREE.NormalBlending
        }, name, link);
    }
}

class HTMLFace extends Face {
    constructor(name, width, height, content) {
        // Create a new canvas with the specified width and height
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        // Create a context and draw the content onto the canvas
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Transparent background
        ctx.fillRect(0, 0, width, height);
        ctx.font = '24px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(content, width / 2, height / 2);

        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create a material with the texture
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });

        super({ material }, name);
    }
}


class NaviCube {

    constructor(materials) {
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        this.mat_map = materials;
        this.materials = materials.map(face => face.face);
        this.face_names = materials.map(face => face.name);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 10;
        this.renderer = new THREE.WebGLRenderer({ alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // this.renderer.setClearColor(0x808080); // Set the background color to gray
        document.body.appendChild(this.renderer.domElement);

        this.info = document.getElementById('info');
        this.rotationInfo = document.getElementById('rotation-info');
        this.cubeSize = 6;
        this.geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);

        this.cube = new THREE.Mesh(this.geometry, this.materials);
        this.scene.add(this.cube);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isRotating = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.inertia = 0.98; // Inertia factor
        this.angularVelocity = new THREE.Vector3(); // Use Vector3 for three rotations

        // Variables to track cube rotation in degrees
        this.totalRotationX = 0;
        this.totalRotationY = 0;
        this.totalRotationZ = 0;

        this.intersects = this.raycaster.intersectObject(this.cube);
        
        this.tristate_clickpress = 0;
        this.stopMovement = false;
        this.minRotationSpeed = 0.02;
        this.maxRotationSpeed = 0.02;

        window.addEventListener('resize', this.onWindowResize, false);
        document.addEventListener('mousedown', this.onMouseDown, false);
        document.addEventListener('mousemove', this.onMouseMove, false);
        document.addEventListener('mouseup', this.onMouseUp, false);
        

        this.onWindowResize();
        this.animate();
        this.applyInertia();
    }

    onWindowResize() {
        // Update camera aspect ratio and renderer size on window resize
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Adjust the cube size based on the new window size
        var aspect = window.innerWidth / window.innerHeight;
        this.cubeSize = aspect >= 1 ? 6 : 6 / aspect;

        // Ensure the cube remains within the camera's view
        if (this.cubeSize > 0) {
            this.geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
            this.cube.geometry.dispose();
            this.cube.geometry = this.geometry;
        }
    }

    updateRotationInfo() {
        this.rotationInfo.textContent = `Rotation Info: X:${this.totalRotationX.toFixed(2)}° Y:${this.totalRotationY.toFixed(2)}° Z:${this.totalRotationZ.toFixed(2)}°`;

        // Calculate camera view direction in world space
        var cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);

        // Normalize the view direction
        cameraDirection.normalize();

        // Create a raycaster and set the ray's origin and direction
        this.raycaster.ray.origin.copy(this.camera.position);
        this.raycaster.ray.direction.copy(cameraDirection);
        this.intersects = this.raycaster.intersectObject(this.cube);

        if (this.intersects.length > 0) {
            var face = this.intersects[0].face;
            var materialIndex = face.materialIndex;

            // Get the color based on the material index
            var name = this.face_names[materialIndex]

            // Display the color in the top left corner
            this.info.textContent = 'Visible Face: ' + name;
        }
    }

    static snapMapping(faceIndex) {
        switch (faceIndex) {
            case 0:
                return 3; //
            case 1:
                return 2;
            case 2:
                return 5;
            case 3:
                return 4;
            case 4:
                return 0;
            case 5:
                return 1;
        }

    }

    snapToFace(faceIndex) {
        // Define target rotations for each face
        var targetRotations = [
            new THREE.Euler(0, 0, 0, 'XYZ'),    // Face 1
            new THREE.Euler(0, Math.PI, 0, 'XYZ'),  // Face 2
            new THREE.Euler(0, Math.PI / 2, 0, 'XYZ'),  // Face 3
            new THREE.Euler(0, -Math.PI / 2, 0, 'XYZ'), // Face 4
            new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ'), // Face 5
            new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ')  // Face 6
        ];

        var targetRotation = targetRotations[faceIndex];

        var currentRotation = this.cube.rotation.clone(); // Clone current rotation
        this.totalRotationX = THREE.Math.radToDeg(currentRotation.x);
        this.totalRotationY = THREE.Math.radToDeg(currentRotation.y);
        this.totalRotationZ = THREE.Math.radToDeg(currentRotation.z);
        this.updateRotationInfo();

        var step = 0;
        var totalSteps = 60; // Adjust the speed of the snap


        const updateRotation = () => {
            if (step < totalSteps) {
                var t = step / totalSteps;
                var rotation = new THREE.Euler();
                rotation.x = currentRotation.x + (targetRotation.x - currentRotation.x) * t;
                rotation.y = currentRotation.y + (targetRotation.y - currentRotation.y) * t;
                rotation.z = currentRotation.z + (targetRotation.z - currentRotation.z) * t;
                this.cube.setRotationFromEuler(rotation);
                step++;
                requestAnimationFrame(updateRotation);

                currentRotation = this.cube.rotation.clone(); // Clone current rotation
                this.totalRotationX = THREE.Math.radToDeg(rotation.x);
                this.totalRotationY = THREE.Math.radToDeg(rotation.y);
                this.totalRotationZ = THREE.Math.radToDeg(rotation.z);
                this.updateRotationInfo();
            }
        }

        updateRotation();
        currentRotation = this.cube.rotation.clone(); // Clone current rotation
        this.totalRotationX = THREE.Math.radToDeg(currentRotation.x);
        this.totalRotationY = THREE.Math.radToDeg(currentRotation.y);
        this.totalRotationZ = THREE.Math.radToDeg(currentRotation.z);
        this.updateRotationInfo();
    }

    onMouseDown(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.intersects = this.raycaster.intersectObject(this.cube);

        if (this.intersects.length > 0) {
            this.isRotating = true;
            this.previousMousePosition = { x: event.clientX, y: event.clientY };
            this.orderFaceRendering();
            this.tristate_clickpress = 1;
            
        }

    }

    onMouseUp(event) {
        if (this.tristate_clickpress == 1) {
            window.location.href = this.mat_map[this.highlighted_index].link;
        }
        if (this.isRotating) {
            // Identify the visible face when the mouse is released
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.intersects = this.raycaster.intersectObject(this.cube);

            // Calculate and update total cube rotation in degrees
            var currentRotation = this.cube.rotation;
            this.totalRotationX = THREE.Math.radToDeg(currentRotation.x);
            this.totalRotationY = THREE.Math.radToDeg(currentRotation.y);
            this.totalRotationZ = THREE.Math.radToDeg(currentRotation.z);
            this.updateRotationInfo();

            this.isRotating = false; // Stop rotating when the mouse is up

            // Apply rotational inertia
            this.angularVelocity.x = (Math.random() - 0.5) * 0.1;
            this.angularVelocity.y = (Math.random() - 0.5) * 0.1;

            // Calculate camera view direction in world space
            var cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);

            // Normalize the view direction
            cameraDirection.normalize();

            // Create a raycaster and set the ray's origin and direction
            this.raycaster.ray.origin.copy(this.camera.position);
            this.raycaster.ray.direction.copy(cameraDirection);
            this.intersects = this.raycaster.intersectObject(this.cube);

            if (this.intersects.length > 0) {
                var face = this.intersects[0].face;
                var materialIndex = face.materialIndex;
                this.snapToFace(NaviCube.snapMapping(materialIndex));
            }
            this.orderFaceRendering();
        }
    }

    onMouseMove(event) {
        this.tristate_clickpress = 0;
        if (this.isRotating) {
            if (this.highlighted_index) {
                this.mat_map[this.highlighted_index].unhighlight();
                this.renderer.render(this.scene, this.camera);
            }

            var deltaMove = {
                x: event.clientX - this.previousMousePosition.x,
                y: event.clientY - this.previousMousePosition.y,
            };

            this.angularVelocity.x = (deltaMove.y * Math.PI) / 180;
            this.angularVelocity.y = (deltaMove.x * Math.PI) / 180;

            var deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(this.angularVelocity.x, this.angularVelocity.y, this.angularVelocity.z, 'XYZ')
            );

            this.cube.quaternion.multiplyQuaternions(deltaRotationQuaternion, this.cube.quaternion);
            this.cube.quaternion.normalize();
            this.previousMousePosition = { x: event.clientX, y: event.clientY };

            var currentRotation = this.cube.rotation;
            this.totalRotationX = THREE.Math.radToDeg(currentRotation.x);
            this.totalRotationY = THREE.Math.radToDeg(currentRotation.y);
            this.totalRotationZ = THREE.Math.radToDeg(currentRotation.z);

            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.intersects = this.raycaster.intersectObject(this.cube);

            this.updateRotationInfo();
            this.orderFaceRendering();
        } else {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.intersects = this.raycaster.intersectObject(this.cube);
    
            if (this.intersects.length > 0) {
                var face = this.intersects[0].face;
                var materialIndex = face.materialIndex;
                this.highlighted_index = materialIndex

                this.mat_map[materialIndex].highlight();
                this.renderer.render(this.scene, this.camera);
            } else {
                if (this.highlighted_index) {
                    this.mat_map[this.highlighted_index].unhighlight();
                    this.renderer.render(this.scene, this.camera);
                }

            }
        }

        
    }

    applyInertia() {
        if (!this.isRotating && this.angularVelocity.length() > 0.001) {
            this.angularVelocity.multiplyScalar(this.inertia);
            var deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(this.angularVelocity.x, this.angularVelocity.y, this.angularVelocity.z, 'XYZ')
            );
            this.cube.quaternion.multiplyQuaternions(deltaRotationQuaternion, this.cube.quaternion);
            this.cube.quaternion.normalize();
            updateRotationInfo();
            this.orderFaceRendering();
        }
    }

    animate() {
        requestAnimationFrame(this.animate);
        this.renderer.render(this.scene, this.camera);
    }

    orderFaceRendering() {
        const geometry = this.cube.geometry;
        const cameraPosition = this.camera.position;
        const center = new THREE.Vector3();
    
        // Create an array to store the faces with their distances
        const facesWithDistances = [];
    
        // Calculate the center of the cube (assuming it's at the origin)
        geometry.computeBoundingBox();
        geometry.boundingBox.getCenter(center);
    
        // Iterate through the faces and calculate their distances from the camera
        for (let i = 0; i < geometry.groups.length; i++) {
            const group = geometry.groups[i];
            const faceCenter = new THREE.Vector3();
            geometry.attributes.position.getY(group.start / 3, faceCenter);
            faceCenter.add(center);
            faceCenter.applyMatrix4(this.cube.matrixWorld);
    
            // Calculate the distance
            const distance = cameraPosition.distanceTo(faceCenter);
    
            // Store the face index and distance
            facesWithDistances.push({ faceIndex: i, distance: distance });
        }
    
        // Sort the faces based on distance (farthest to nearest)
        facesWithDistances.sort((a, b) => b.distance - a.distance);
    
        // Create a new ordered groups array
        const orderedGroups = [];
        for (let i = 0; i < facesWithDistances.length; i++) {
            const face = facesWithDistances[i];
            const group = geometry.groups[face.faceIndex];
            orderedGroups.push(group);
        }
    
        // Replace the geometry groups with the sorted groups
        geometry.groups = orderedGroups;
    
        // Notify Three.js that the materials need an update
        geometry.groupsNeedUpdate = true;
    }
    
    
    randomRotateCube() {
        const minRotationSpeed = 0.005;
        const maxRotationSpeed = 0.02;
    
        const rotationX = (Math.random() * (maxRotationSpeed - minRotationSpeed) + minRotationSpeed);
        const rotationY = (Math.random() * (maxRotationSpeed - minRotationSpeed) + minRotationSpeed);
        const rotationZ = (Math.random() * (maxRotationSpeed - minRotationSpeed) + minRotationSpeed);
    
        const animateRotation = () => {
            if (this.stopMovement) {return;}
            this.cube.rotation.x += rotationX;
            this.cube.rotation.y += rotationY;
            this.cube.rotation.z += rotationZ;
    
            // Render the scene
            this.renderer.render(this.scene, this.camera);
    
            // Request the next frame
            requestAnimationFrame(animateRotation);
        };
    
        animateRotation();
    }

    randomWindUp() {    
        let rotationX = (Math.random() * (this.maxRotationSpeed - this.minRotationSpeed) + this.minRotationSpeed);
        let rotationY = (Math.random() * (this.maxRotationSpeed - this.minRotationSpeed) + this.minRotationSpeed);
        let rotationZ = (Math.random() * (this.maxRotationSpeed - this.minRotationSpeed) + this.minRotationSpeed);
    
        const animateRotation = () => {
            if (this.stopMovement) {return;}
            this.cube.rotation.x += rotationX;
            this.cube.rotation.y += rotationY;
            this.cube.rotation.z += rotationZ;
    
            // Render the scene
            this.renderer.render(this.scene, this.camera);

            this.maxRotationSpeed += 0.001;
            this.minRotationSpeed += 0.001;
    
            // Request the next frame
            requestAnimationFrame(animateRotation);
        };
    
        animateRotation();
    }

    stopRotation() {
        self.stopMovement = true;
    }

}


materials = [
    new ColourFace(GRAY_PURPLE, "Face 1", "google.com", opacity=0.2),
    new ColourFace(GRAY_PURPLE, "Face 2", "google.com", opacity=0.2),
    new ColourFace(LAVENDER, "Face 3", "google.com", opacity=0.2),
    new ColourFace(LAVENDER, "Face 4", "google.com", opacity=0.2),
    new ColourFace(PURPLE, "Face 5", "google.com", opacity=0.2),
    new ImageFace("uqrl.png", "Face 6", "google.com", opacity=0.2)
];

mainCube = new NaviCube(materials);