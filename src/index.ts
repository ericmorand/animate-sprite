import set = Reflect.set;

declare type Settings = {
    width: number,
    height: number,
    frames: number,
    cols?: number,
    loop?: boolean,
    reverse?: boolean,
    autoplay?: boolean,
    frameTime?: number,
    duration?: number,
    fps?: number,
    draggable?: number
}

declare type WritableSettings = {
    frameTime?: number,
    duration?: number,
    fps?: number
}

declare type SwipeEvent =
    'mousedown'
    | 'mousemove'
    | 'mouseup'
    | 'touchstart'
    | 'touchmove'
    | 'touchend'
    | 'touchcancel';

export interface PluginInterface {
    play(): this;

    stop(): this;

    toggle(): this;

    next(): this;

    prev(): this;

    reset(): this;

    setFrame(frame: number): this;

    getCurrentFrame(): number;

    setReverse(reverse: boolean): this;

    isAnimating(): boolean;

    setOption<Key extends keyof WritableSettings>(key: Key, value: WritableSettings[Key]): this;

    getOption<Key extends keyof WritableSettings>(key: Key): WritableSettings[Key];

    destroy(): this;
}

export function init(node: HTMLElement, settings: Settings): PluginInterface {
    let currentFrame: number = 1,
        isAnimating: boolean = false,
        duration: number,
        lastUpdate: number,
        isSwiping: boolean = false,
        swipeThreshold: number,
        swipePixelsCorrection: number = 0,
        nodeWidth: number,
        nodeHeight: number,
        widthHeightRatio: number,
        bgWidth: number,
        bgHeight: number;

    if (settings.fps === undefined) {
        settings.fps = 24;
    }

    class SwipeObject {
        protected _prevX: number;
        protected _prevY: number;
        protected _curX: number;
        protected _curY: number;

        set prevX(value) {
            this._prevX = value;
        }

        get prevX() {
            return this._prevX;
        }

        set prevY(value) {
            this._prevY = value;
        }

        get prevY() {
            return this._prevY;
        }

        set curX(value) {
            this._curX = value;
        }

        get curX() {
            return this._curX;
        }

        set curY(value) {
            this._curY = value;
        }

        get curY() {
            return this._curY;
        }
    }

    let swipeObject: SwipeObject = new SwipeObject();

    class Plugin implements PluginInterface {
        play() {
            if (isAnimating) return;
            isAnimating = true;
            lastUpdate = performance.now();
            requestAnimationFrame(animate);
            return this;
        }

        stop() {
            isAnimating = false;
            return this;
        }

        toggle() {
            if (!isAnimating) this.play();
            else this.stop();
            return this;
        }

        next() {
            this.stop();
            changeFrame(currentFrame + 1);
            return this;
        }

        prev() {
            this.stop();
            changeFrame(currentFrame - 1);
            return this;
        }

        reset() {
            this.stop();
            changeFrame(1);
            return this;
        }

        setFrame(frame: number) {
            this.stop();
            changeFrame(frame);
            return this;
        }

        getCurrentFrame() {
            return currentFrame;
        }

        setReverse(reverse: boolean) {
            settings.reverse = reverse;
            return this;
        }

        isAnimating() {
            return isAnimating;
        }

        setOption<Key extends keyof WritableSettings>(key: Key, value: WritableSettings[Key]) {
            settings.frameTime = settings.duration = settings.fps = undefined;
            settings[key] = value;

            duration = calculateDuration(settings.frameTime, settings.duration, settings.fps);

            if (isAnimating) {
                this.stop();
                this.play();
            }

            return this;
        }

        getOption<Key extends keyof Settings>(key: Key): Settings[Key] {
            return settings[key];
        }

        destroy() {
            removeSwipeEvents(node, swipeHandler, swipeEvents);
            removeResizeHandler(calculateSizes);
            return this;
        }
    }

    const plugin = new Plugin();

    const swipeEvents: Array<SwipeEvent> = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];

    // Private functions
    function animateSprite(frame: number) {
        node.style.backgroundPosition = calculatePosition(frame);
    }

    function changeFrame(frame: number) {
        if (frame === currentFrame) return;
        if (!isOutOfRange(frame)) { // Valid frame
            animateSprite(frame);
            checkForEvents(currentFrame, frame);
            currentFrame = frame;
        } else { // Out of range
            if (settings.loop) { // Loop, change frame and continue
                changeFrame(Math.abs(Math.abs(frame) - settings.frames)); // Correct frame
            } else { // No loop, stop playing
                plugin.stop();
                if (frame < 1) changeFrame(1);
                else changeFrame(settings.frames);
            }
        }
    }

    function getNextFrame(deltaFrames: number) {
        return (settings.reverse) ? currentFrame + deltaFrames : currentFrame - deltaFrames;
    }

    function isOutOfRange(frame: number) {
        return (frame <= 0 || frame > settings.frames);
    }

    function calculatePosition(frame: number) {
        let xPadding,
            yPadding = 0;
        if (!settings.cols) { // Single row sprite
            xPadding = (frame - 1) * nodeWidth;
        } else { // Multiline sprite
            xPadding = (((frame - 1) % settings.cols)) * nodeWidth;
            yPadding = Math.floor((frame - 1) / settings.cols) * nodeHeight;
        }
        return `-${xPadding}px -${yPadding}px`;
    }

    function calculateDuration(frameTime: number, duration: number, fps: number) {
        if (frameTime) {
            return frameTime * settings.frames;
        } else if (duration) {
            return duration;
        } else {
            return (settings.frames / fps) * 1000;
        }
    }

    function animate(time: number) {
        const progress = (time - lastUpdate) / duration;
        const deltaFrames = progress * settings.frames;

        if (deltaFrames >= 1) {
            changeFrame(getNextFrame(Math.floor(deltaFrames)));
            lastUpdate = performance.now();
        }

        if (isAnimating) {
            requestAnimationFrame(animate);
        }
    }

    function calculateSizes() {
        const wasAnimating = isAnimating;
        plugin.stop();
        widthHeightRatio = settings.width / settings.height;
        nodeWidth = node.offsetWidth;
        nodeHeight = nodeWidth / widthHeightRatio;
        node.style.height = nodeHeight + "px";
        swipeThreshold = nodeWidth / settings.frames;
        bgWidth = (!settings.cols)
            ? settings.frames * nodeWidth
            : settings.cols * nodeWidth;
        bgHeight = (!settings.cols)
            ? nodeHeight
            : Math.ceil(settings.frames / settings.cols) * nodeHeight;
        node.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
        if (wasAnimating) plugin.play();
        else changeFrame(1);
    }

    function checkForEvents(prevFrame: number, nextFrame: number) {
        if ((prevFrame === settings.frames - 1) && (nextFrame === settings.frames)) {
            node.dispatchEvent(new Event('sprite:last-frame'));
        } else if ((prevFrame === 2) && (nextFrame === 1)) {
            node.dispatchEvent(new Event('sprite:first-frame'));
        }
    }

    function initPlugin() {
        duration = calculateDuration(settings.frameTime, settings.duration, settings.fps);
        lastUpdate = Date.now();

        calculateSizes();
        addResizeHandler(calculateSizes);

        if (settings.autoplay) plugin.play();
        if (settings.draggable) {
            setupSwipeEvents(node, swipeHandler, swipeEvents);
            node.style.cursor = 'grab';
        }
    }

    //===================== SWIPE ROTATION ====================//
    function swipeHandler(event: MouseEvent | TouchEvent) {
        if (event instanceof TouchEvent) {
            const touches = event.touches;
            swipeObject.curX = touches[0].pageX;
            swipeObject.curY = touches[0].pageY;
        } else {
            swipeObject.curX = event.clientX;
            swipeObject.curY = event.clientY;
        }

        switch (event.type) {
            case 'mousedown':
            case 'touchstart':
                if (event.type === 'touchstart') event.preventDefault();
                document.addEventListener('mouseup', swipeHandler);
                document.addEventListener('mousemove', swipeHandler);
                swipeStart();
                break;
            case 'mousemove':
            case 'touchmove':
                if (event.type === 'touchmove') event.preventDefault();
                if (isSwiping) swipeMove();
                break;
            case 'mouseup':
            case 'touchend':
            case 'touchcancel':
                if (event.type === 'touchend' || event.type === 'touchcancel') event.preventDefault();
                document.removeEventListener('mouseup', swipeHandler);
                document.removeEventListener('mousemove', swipeHandler);
                swipeEnd();
                break;
        }
    }

    function swipeStart() {
        isAnimating = false;
        isSwiping = true;
        node.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        swipeObject.prevX = swipeObject.curX;
        swipeObject.prevY = swipeObject.curY;
    }

    function swipeMove() {
        const direction = swipeDirection();
        swipeObject.prevY = swipeObject.curY; // Update Y to get right angle

        const swipeLength = Math.round(Math.abs(swipeObject.curX - swipeObject.prevX)) + swipePixelsCorrection;
        if (swipeLength <= swipeThreshold) return; // Ignore if less than 1 frame
        if (direction !== 'left' && direction !== 'right') return; // Ignore vertical directions
        swipeObject.prevX = swipeObject.curX;

        const progress = swipeLength / nodeWidth;
        const deltaFrames = Math.floor(progress * settings.frames);
        // Add pixels to the next swipeMove if frames equivalent of swipe is not an integer number,
        // e.g one frame is 10px, swipeLength is 13px, we change 1 frame and add 3px to the next swipe,
        // so fullwidth swipe is always rotate sprite for 1 turn
        swipePixelsCorrection = swipeLength - (swipeThreshold * deltaFrames);
        changeFrame(getNextFrame(deltaFrames));
    }

    function swipeEnd() {
        swipeObject = new SwipeObject();
        isSwiping = false;
        node.style.cursor = 'grab';
        document.body.style.cursor = 'default';
    }

    function swipeDirection() {
        let xDist, yDist, r, swipeAngle;
        xDist = swipeObject.prevX - swipeObject.curX;
        yDist = swipeObject.prevY - swipeObject.curY;
        r = Math.atan2(yDist, xDist);
        swipeAngle = Math.round(r * 180 / Math.PI);
        if (swipeAngle < 0) swipeAngle = 360 - Math.abs(swipeAngle);
        if ((swipeAngle >= 0 && swipeAngle <= 60) || (swipeAngle <= 360 && swipeAngle >= 300)) return 'left';
        else if (swipeAngle >= 120 && swipeAngle <= 240) return 'right';
        else if (swipeAngle >= 241 && swipeAngle <= 299) return 'bottom';
        else return 'up';
    }

    //===================== END SWIPE ====================//

    initPlugin();

    return plugin;
}

function addResizeHandler(cb: EventHandlerNonNull) {
    window.addEventListener("resize", cb); // todo add debouncing
}

function removeResizeHandler(cb: EventHandlerNonNull) {
    window.removeEventListener("resize", cb);
}

function setupSwipeEvents(node: HTMLElement, swipeHandler: EventHandlerNonNull, swipeEvents: Array<SwipeEvent>) {
    swipeEvents.forEach((value) => {
        node.addEventListener(value, swipeHandler);
    })
}

function removeSwipeEvents(node: HTMLElement, swipeHandler: EventHandlerNonNull, swipeEvents: Array<SwipeEvent>) {
    swipeEvents.forEach((value) => {
        node.removeEventListener(value, swipeHandler);
    })
}


