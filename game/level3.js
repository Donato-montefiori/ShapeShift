function drawLevel3() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let time = Date.now()/600;

    // Fondo negro base
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!crystalActivated) {
        // Solo dibujar los ojos brillantes del héroe
        ctx.save();
        let eyeColor;
        if (playerForm === FORMS.DESTRUCTOR) eyeColor = '#ff2e2e';
        if (playerForm === FORMS.NINJA) eyeColor = '#2e8bff';
        if (playerForm === FORMS.MAGO) eyeColor = '#ffe359';

        // Brillo alrededor de los ojos
        let eyeX = player.x - cameraX + player.w/2;
        let eyeY = player.y + player.h/2 - 8;
        
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = eyeColor;
        
        // Ojos con brillo
        ctx.beginPath();
        ctx.arc(eyeX - 10, eyeY, 5, 0, Math.PI*2);
        ctx.arc(eyeX + 10, eyeY, 5, 0, Math.PI*2);
        ctx.fill();
        
        // Débil resplandor del cristal a lo lejos
        let crystal = cuevaElements.find(e => e.type === 'crystal');
        if (crystal) {
            let distance = Math.abs((crystal.x + crystal.w/2) - (player.x + player.w/2));
            let alpha = Math.max(0, 0.1 - distance/2000);
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#2e8bff';
            ctx.beginPath();
            ctx.arc(crystal.x - cameraX + crystal.w/2, crystal.y + crystal.h/2, 30, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    } else {
        // Dibujar la cueva iluminada
        drawCaveBackground();
        
        // Dibujar elementos de la cueva
        cuevaElements.forEach(el => {
            let ex = el.x - cameraX;
            
            if (el.type === 'crystal') {
                drawCrystal(ex, el.y, el.w, el.h, el.active);
            }
            else if (el.type === 'platform') {
                drawPlatform(ex, el.y, el.w, el.h);
            }
            else if (el.type === 'lever' && !cartRiding) {
                drawLever(ex, el.y, el.w, el.h, el.pulled);
            }
            else if (el.type === 'cart') {
                drawCart(cartRiding ? cartX - cameraX : ex, cartY, el.w, el.h);
            }
            else if (el.type === 'track') {
                drawTrack(ex, el.y, el.w, el.h);
            }
        });

        // Dibujar murciélagos
        drawBats();
        
        // Dibujar caminos cuando esté en el carrito
        if (cartRiding) {
            drawPaths();
        }
    }

    // Siempre dibujar el jugador (excepto en carrito)
    if (!cartRiding) {
        drawPlayer(cameraX);
    }

    // UI
    drawText(`Forma: ${playerForm.toUpperCase()}`, canvas.width-40, 40, 24, '#fff', 'right');
}

function drawCaveBackground() {
    // Paredes de la cueva con textura
    ctx.save();
    let rockPattern = ctx.createPattern(createRockTexture(), 'repeat');
    ctx.fillStyle = rockPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cristales pequeños incrustados
    let time = Date.now()/1000;
    for(let i=0; i<20; i++) {
        let x = ((i*547 + cameraX/2)%canvas.width + canvas.width)%canvas.width;
        let y = (i*237)%canvas.height;
        
        ctx.fillStyle = `rgba(46,139,255,${0.3 + Math.sin(time+i)*0.2})`;
        ctx.beginPath();
        ctx.moveTo(x, y-10);
        ctx.lineTo(x+8, y);
        ctx.lineTo(x, y+10);
        ctx.lineTo(x-8, y);
        ctx.closePath();
        ctx.fill();
    }

    // Estalactitas en el techo
    ctx.fillStyle = '#2a2a2a';
    for(let i=0; i<canvas.width; i+=60) {
        let height = 40 + Math.sin(i*0.1)*20;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i+20, height);
        ctx.lineTo(i-20, height);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function createRockTexture() {
    let canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    let ctx = canvas.getContext('2d');
    
    // Base color
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, 128, 128);
    
    // Random rocky texture
    for(let i=0; i<50; i++) {
        ctx.fillStyle = `rgba(${20+Math.random()*20},${20+Math.random()*20},${20+Math.random()*20},0.5)`;
        ctx.beginPath();
        ctx.arc(Math.random()*128, Math.random()*128, Math.random()*10+5, 0, Math.PI*2);
        ctx.fill();
    }
    
    return canvas;
}

function drawCrystal(x, y, w, h, active) {
    ctx.save();
    let time = Date.now()/1000;
    
    // Base del cristal
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x+w/2, y-h/4);
    ctx.lineTo(x+w, y);
    ctx.lineTo(x+w, y+h);
    ctx.lineTo(x+w/2, y+h+h/4);
    ctx.lineTo(x, y+h);
    ctx.closePath();
    
    // Gradiente y brillo
    let grad = ctx.createLinearGradient(x, y, x+w, y+h);
    grad.addColorStop(0, `rgba(46,139,255,${active ? 0.8 : 0.3})`);
    grad.addColorStop(0.5, `rgba(100,200,255,${active ? 0.9 : 0.4})`);
    grad.addColorStop(1, `rgba(46,139,255,${active ? 0.8 : 0.3})`);
    
    ctx.fillStyle = grad;
    ctx.shadowColor = '#2e8bff';
    ctx.shadowBlur = active ? 30 : 10;
    ctx.fill();
    
    // Destellos internos
    if (active) {
        ctx.globalAlpha = 0.5 + Math.sin(time*3)*0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x+w*0.3, y+h*0.3);
        ctx.lineTo(x+w*0.7, y+h*0.3);
        ctx.lineTo(x+w*0.5, y+h*0.7);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawPlatform(x, y, w, h) {
    ctx.save();
    // Plataforma de roca
    let grad = ctx.createLinearGradient(x, y, x, y+h);
    grad.addColorStop(0, '#4a4a4a');
    grad.addColorStop(1, '#2a2a2a');
    
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    
    // Detalles de roca
    ctx.globalAlpha = 0.3;
    for(let i=0; i<w; i+=10) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x+i, y, 2, h);
    }
    ctx.restore();
}

function drawLever(x, y, w, h, pulled) {
    ctx.save();
    // Base de la palanca
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x-5, y, w+10, h/2);
    
    // Palanca
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x+w/2, y+h/4);
    let angle = pulled ? Math.PI/4 : -Math.PI/4;
    ctx.lineTo(x+w/2 + Math.cos(angle)*h, y+h/4 + Math.sin(angle)*h);
    ctx.stroke();
    
    // Tornillos
    ctx.fillStyle = '#6a6a6a';
    ctx.beginPath();
    ctx.arc(x, y+h/4, 4, 0, Math.PI*2);
    ctx.arc(x+w, y+h/4, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

function drawCart(x, y, w, h) {
    ctx.save();
    // Cuerpo del carrito
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x, y, w, h*0.7);
    
    // Ruedas
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(x+w*0.2, y+h*0.8, h*0.2, 0, Math.PI*2);
    ctx.arc(x+w*0.8, y+h*0.8, h*0.2, 0, Math.PI*2);
    ctx.fill();
    
    // Detalles metálicos
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x+5, y+5, w-10, h*0.6-10);
    
    if (cartRiding) {
        // Dibujar jugador en el carrito
        let playerColor;
        if (playerForm === FORMS.DESTRUCTOR) playerColor = '#ff2e2e';
        if (playerForm === FORMS.NINJA) playerColor = '#2e8bff';
        if (playerForm === FORMS.MAGO) playerColor = '#ffe359';
        
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.ellipse(x+w/2, y+h*0.3, 20, 30, 0, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.restore();
}

function drawTrack(x, y, w, h) {
    ctx.save();
    // Rieles
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x+w, y);
    ctx.stroke();
    
    // Travesaños
    ctx.fillStyle = '#3a3a3a';
    for(let i=0; i<w; i+=40) {
        ctx.fillRect(x+i, y-h/2, 30, h);
    }
    ctx.restore();
}

function drawBats() {
    let time = Date.now()/600;
    ctx.save();
    batsChasing.forEach(bat => {
        let bx = bat.x - cameraX;
        let by = bat.y + Math.sin(time * bat.frequency) * bat.amplitude;
        
        // Cuerpo del murciélago
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(bx, by, bat.w/3, bat.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Alas
        let wingAngle = Math.sin(time*4) * Math.PI/4;
        
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(
            bx - bat.w/2, by - bat.h/2 * Math.sin(wingAngle),
            bx - bat.w/2, by + bat.h/2
        );
        ctx.quadraticCurveTo(bx - bat.w/4, by, bx, by);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(
            bx + bat.w/2, by - bat.h/2 * Math.sin(wingAngle),
            bx + bat.w/2, by + bat.h/2
        );
        ctx.quadraticCurveTo(bx + bat.w/4, by, bx, by);
        ctx.fill();
        
        // Ojos rojos
        ctx.fillStyle = '#ff0000';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(bx-5, by-2, 2, 0, Math.PI*2);
        ctx.arc(bx+5, by-2, 2, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.restore();
}

function drawPaths() {
    // Dibujar caminos disponibles
    pathOptions.forEach(path => {
        let px = path.x - cameraX;
        ctx.save();
        ctx.strokeStyle = path.broken ? '#ff2e2e' : '#4a4a4a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(px, path.y);
        ctx.lineTo(px + path.w, path.y + path.h);
        ctx.stroke();
        ctx.restore();
    });
}

function updatePlayerCueva() {
    if (cartRiding) {
        updateCartRide();
        return;
    }

    // Movimiento normal del jugador
    let speed = 5;
    if (playerForm === FORMS.DESTRUCTOR && player.embestida) speed = 10;
    if (playerForm === FORMS.NINJA) speed = 7;
    
    if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -speed;
    else if (keys['ArrowRight'] || keys['KeyD']) player.vx = speed;
    else player.vx = 0;

    // Salto
    if ((keys['Space'] || keys['KeyW']) && player.onGround) {
        if (playerForm === FORMS.NINJA) {
            player.vy = -18;
            player.canDoubleJump = true;
        } else if (playerForm === FORMS.MAGO) {
            player.vy = -15;
            player.levitating = true;
            player.levitateTimer = 0;
        } else {
            player.vy = -12;
        }
        player.onGround = false;
    }

    // Doble salto del ninja
    if (playerForm === FORMS.NINJA && (keys['Space'] || keys['KeyW']) && player.canDoubleJump && !player.onGround) {
        player.vy = -16;
        player.canDoubleJump = false;
    }

    // Levitación del mago
    if (playerForm === FORMS.MAGO && !player.onGround) {
        if (keys['Space'] && player.levitateTimer < 2) {
            player.vy = Math.max(player.vy, 0);
            player.levitateTimer += 1/60;
        } else {
            player.vy += 0.8;
        }
    } else {
        player.levitateTimer = 0;
    }

    if (!player.onGround && playerForm !== FORMS.MAGO) player.vy += 0.6;

    // Actualizar posición
    player.x += player.vx;
    player.y += player.vy;

    // Actualizar cámara
    cameraX = Math.max(0, Math.min(player.x + player.w/2 - canvas.width/2, level3Width-canvas.width));

    // Colisiones con elementos
    player.onGround = false;
    cuevaElements.forEach(el => {
        if (el.type === 'platform' && collide(player, el)) {
            player.y = el.y - player.h;
            player.vy = 0;
            player.onGround = true;
        }
        else if (el.type === 'crystal' && !crystalActivated && collide(player, el)) {
            crystalActivated = true;
            lightRadius = 300;
            el.active = true;
        }
        else if (el.type === 'lever' && !leverPulled && collide(player, el)) {
            if (keys['KeyE']) {
                leverPulled = true;
                el.pulled = true;
            }
        }
        else if (el.type === 'cart' && leverPulled && el.locked && collide(player, el)) {
            if (playerForm === FORMS.DESTRUCTOR && keys['KeyE']) {
                el.locked = false;
                cartActivated = true;
            }
        }
        else if (el.type === 'cart' && !el.locked && collide(player, el)) {
            cartRiding = true;
            cartSpeed = 5;
            generateNextPath();
        }
    });

    // Límites del nivel
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > level3Width) player.x = level3Width - player.w;
    if (player.y + player.h > canvas.height) {
        player.y = canvas.height - player.h;
        player.vy = 0;
        player.onGround = true;
    }
}

function updateCartRide() {
    // Velocidad base del carrito
    let baseSpeed = 5;
    if (playerForm === FORMS.DESTRUCTOR) baseSpeed = 3; // Más lento con Destructor
    
    cartSpeed = baseSpeed;
    cartX += cartSpeed;
    cameraX = Math.max(0, Math.min(cartX - canvas.width/3, level3Width-canvas.width));

    // Controles en el carrito
    if (keys['KeyA'] || keys['KeyD']) {
        handlePathChoice(keys['KeyD'] ? 'right' : 'left');
    }

    if (keys['KeyW'] && !player.jumping) {
        player.jumping = true;
        player.jumpY = cartY;
    }

    // Actualizar salto
    if (player.jumping) {
        let jumpProgress = (cartX - player.jumpStart) / 300; // 300px de distancia de salto
        if (jumpProgress <= 1) {
            cartY = player.jumpY - Math.sin(jumpProgress * Math.PI) * 150; // 150px altura máxima
        } else {
            player.jumping = false;
            cartY = canvas.height - 150;
        }
    }

    // Colisiones con obstáculos
    if (nextObstacle && cartX > nextObstacle.x) {
        if (nextObstacle.type === 'gap' && currentPath === nextObstacle.badPath) {
            resetLevel();
            return;
        }
        if (nextObstacle.type === 'barrier') {
            if (player.jumping) {
                // Pasó por debajo/arriba
            } else if (playerForm === FORMS.DESTRUCTOR && keys['KeyE']) {
                // Rompió la barrera
            } else {
                resetLevel();
                return;
            }
        }
        generateNextPath();
    }

    // Actualizar murciélagos perseguidores
    batsChasing.forEach(bat => {
        let dx = cartX - bat.x;
        let dy = cartY - bat.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        bat.x += (dx/dist) * bat.speed;
        bat.y += (dy/dist) * bat.speed;

        // Si un murciélago te alcanza
        if (dist < 50) {
            resetLevel();
        }
    });

    // Generar nuevos murciélagos
    if (Math.random() < 0.01 && batsChasing.length < 5) {
        batsChasing.push({
            ...batTemplate,
            x: cartX - canvas.width,
            y: Math.random() * (canvas.height - 200)
        });
    }

    // Victoria al llegar al final
    if (cartX > level3Width - 200) {
        state = GAME_STATE.WIN;
    }
}

function generateNextPath() {
    // Limpiar caminos anteriores
    pathOptions = [];
    
    // Generar nuevos caminos
    let pathStart = cartX + canvas.width/2;
    let pathTypes = ['split', 'barrier', 'split', 'barrier'];
    let pathType = pathTypes[Math.floor(Math.random() * pathTypes.length)];
    
    if (pathType === 'split') {
        // Generar bifurcación
        let badPath = Math.random() < 0.5 ? 'left' : 'right';
        pathOptions = [
            {
                x: pathStart,
                y: canvas.height - 150,
                w: 400,
                h: badPath === 'left' ? 100 : -100,
                broken: badPath === 'left'
            },
            {
                x: pathStart,
                y: canvas.height - 150,
                w: 400,
                h: badPath === 'right' ? 100 : -100,
                broken: badPath === 'right'
            }
        ];
        nextObstacle = {
            type: 'gap',
            x: pathStart + 400,
            badPath: badPath
        };
    } else {
        // Generar barrera
        nextObstacle = {
            type: 'barrier',
            x: pathStart + 300,
            y: canvas.height - 200,
            w: 40,
            h: 100
        };
    }
}

function handlePathChoice(choice) {
    if (pathOptions.length === 0 || currentPath === choice) return;
    currentPath = choice;
}
