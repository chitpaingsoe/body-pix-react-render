import React, { useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import dat from 'dat.gui';
import Stats from 'stats.js';

import { drawKeypoints, drawSkeleton, toggleLoadingUI, TRY_RESNET_BUTTON_NAME, TRY_RESNET_BUTTON_TEXT, updateTryResNetButtonDatGuiCss } from './demo_utils';
import * as partColorScales from './part_color_scales';



export default (props) => {
    const default_option = {
        algorithm: 'person',
        estimate: 'segmentation',
        camera: null,
        flipHorizontal: true,
        maskType: "room",
        input: {
            architecture: 'MobileNetV1',
            outputStride: 16,
            internalResolution: 'medium',
            multiplier: 0.50,
            quantBytes: 2
        },
        multiPersonDecoding: {
            maxDetections: 5,
            scoreThreshold: 0.3,
            nmsRadius: 20,
            numKeypointForMatching: 17,
            refineSteps: 10
        },
        segmentation: {
            segmentationThreshold: 0.7,
            effect: 'mask',
            maskBackground: true,
            opacity: 0.98,
            backgroundBlurAmount: 3,
            maskBlurAmount: 0,
            edgeBlurAmount: 3
        },
        partMap: {
            colorScale: 'rainbow',
            effect: 'partMap',
            segmentationThreshold: 0.5,
            opacity: 0.9,
            blurBodyPartAmount: 3,
            bodyPartEdgeBlurAmount: 3,
        },
        showFps: !isMobile()
    };

    const addOptions = (options) => {
        let __guiState = default_option;
        let keys = Object.keys(options);
        (keys).forEach((key) => {
            let option = options[key];
            switch (key) {
                case "showFps":
                    if (typeof (option) === "boolean") {
                        __guiState.showFps = option;
                    }

                    break;
                case "maskType":
                    if (option) {
                        __guiState.maskType = option;
                    }
                    break;
                case "flipHorizontal":
                    if (typeof (option) === 'boolean') {
                        __guiState.flipHorizontal = option;
                    }
                    break;
                case "input":
                    if (typeof (option) === 'object') {
                        let input_keys = Object.keys(option);
                        (input_keys).forEach(ik => {
                            __guiState.input[ik] = option[ik];
                        })
                    }
                    break;
                case "multiPersonDecoding":
                    if (typeof (option) === 'object') {
                        let multiPersonDecoding_keys = Object.keys(option);
                        (multiPersonDecoding_keys).forEach(mk => {
                            __guiState.multiPersonDecoding[mk] = option[mk];
                        })
                    }
                    break;
                case "segmentation":
                    if (typeof (option) === 'object') {
                        let segmentation_keys = Object.keys(option);
                        (segmentation_keys).forEach(sk => {
                            __guiState.segmentation[sk] = option[sk];
                        })
                    }
                    break;

                default:
                    break;
            }
        });
        return __guiState;
    }

    const options = props.options || {};
    const onEvent = props.onEvent || null;
    const start = props.start || false;
    let maskType = typeof(props.options.maskType) === "string" ? props.options.maskType : "room";
    const visible = props.visible || false;
    let guiState = addOptions(options);

    const [running, setRunning] = useState(false);


    useEffect(() => {
        if (start && !running) {

            (async function load() {
                navigator.getUserMedia = navigator.getUserMedia ||
                    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

                await bindPage();
                const canvas = document.getElementById('output');
                const canvasStream = canvas.captureStream();
                if (onEvent) {
                    if (!state.net) {
                        onEvent({
                            event: "NOT_READY",
                            stream: null
                        })
                    } else {
                        onEvent({
                            event: "READY",
                            stream: canvasStream
                        })
                    }

                }
                setRunning(true)
            })();

        } else {
            // const canvas = document.getElementById('output');

            // const context = canvas.getContext('2d');

            // context.clearRect(0, 0, canvas.width, canvas.height);


            // console.log("stop: ",state.video)
            // stopExistingVideoCapture();
        }
    }, [start])

    useEffect(() => {
        hidePanel(visible ? true : false)
    }, [visible]);




    const stats = new Stats();

    const state = {
        video: null,
        stream: null,
        net: null,
        videoConstraints: {},
        // Triggers the TensorFlow model to reload
        changingArchitecture: false,
        changingMultiplier: false,
        changingStride: false,
        changingResolution: false,
        changingQuantBytes: false,
    };

    function isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    function isiOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    function isMobile() {
        return isAndroid() || isiOS();
    }

    async function getVideoInputs() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.log('enumerateDevices() not supported.');
            return [];
        }

        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        return videoDevices;
    }

    function stopExistingVideoCapture() {
        if (state.video && state.video.srcObject) {
            state.video.srcObject.getTracks().forEach(track => {
                track.stop();
            })
            state.video.srcObject = null;
        }
    }

    async function getDeviceIdForLabel(cameraLabel) {
        const videoInputs = await getVideoInputs();

        for (let i = 0; i < videoInputs.length; i++) {
            const videoInput = videoInputs[i];
            if (videoInput.label === cameraLabel) {
                return videoInput.deviceId;
            }
        }

        return null;
    }

    // on mobile, facing mode is the preferred way to select a camera.
    // Here we use the camera label to determine if its the environment or
    // user facing camera
    function getFacingMode(cameraLabel) {
        if (!cameraLabel) {
            return 'user';
        }
        if (cameraLabel.toLowerCase().includes('back')) {
            return 'environment';
        } else {
            return 'user';
        }
    }

    async function getConstraints(cameraLabel) {
        let deviceId;
        let facingMode;

        if (cameraLabel) {
            deviceId = await getDeviceIdForLabel(cameraLabel);
            // on mobile, use the facing mode based on the camera.
            facingMode = isMobile() ? getFacingMode(cameraLabel) : null;
        };
        return { deviceId, facingMode };
    }

    /**
     * Loads a the camera to be used in the demo
     *
     */
    async function setupCamera(cameraLabel) {

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                'Browser API navigator.mediaDevices.getUserMedia not available');
        }

        const videoElement = document.getElementById('video');

        stopExistingVideoCapture();

        const mediaOptions = options.mediaOptions ?? {};
        let inputVideoOptions = mediaOptions.video ?? null;
        let inputAudioOptions = mediaOptions.audio ?? true;
        const videoConstraints = inputVideoOptions ?? await getConstraints(cameraLabel);

        console.log("MeidaOptions- video: ", videoConstraints , " , audio: ",inputAudioOptions)

        const stream = await navigator.mediaDevices.getUserMedia(
            { 'audio': inputAudioOptions, 'video': videoConstraints });
        videoElement.srcObject = stream;

        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.width = videoElement.videoWidth;
                videoElement.height = videoElement.videoHeight;
                resolve(videoElement);
            };
        });
    }

    async function loadVideo(cameraLabel) {
        try {
            state.video = await setupCamera(cameraLabel);
        } catch (e) {
            let info = document.getElementById('info');
            info.textContent = 'this browser does not support video capture,' +
                'or this device does not have a camera';
            info.style.display = 'block';
            throw e;
        }

        state.video.play();
    }

    const defaultQuantBytes = 2;

    const defaultMobileNetMultiplier = isMobile() ? 0.50 : 0.75;
    const defaultMobileNetStride = 16;
    const defaultMobileNetInternalResolution = 'medium';

    const defaultResNetMultiplier = 1.0;
    const defaultResNetStride = 16;
    const defaultResNetInternalResolution = 'low';

    

    function toCameraOptions(cameras) {
        const result = { default: null };

        cameras.forEach(camera => {
            result[camera.label] = camera.label;
        })

        return result;
    }

    /**
     * Sets up dat.gui controller on the top-right of the window
     */
    function setupGui(cameras) {
        const gui = new dat.GUI({ width: 300 });

        let architectureController = null;
        guiState[TRY_RESNET_BUTTON_NAME] = function () {
            architectureController.setValue('ResNet50')
        };
        //   gui.add(guiState, TRY_RESNET_BUTTON_NAME).name(TRY_RESNET_BUTTON_TEXT);
        updateTryResNetButtonDatGuiCss();

        gui.add(guiState, 'camera', toCameraOptions(cameras))
            .onChange(async function (cameraLabel) {
                state.changingCamera = true;

                await loadVideo(cameraLabel);

                state.changingCamera = false;
            });

        gui.add(guiState, 'flipHorizontal');

        // There are two algorithms 'person' and 'multi-person-instance'.
        // The 'person' algorithm returns one single segmentation mask (or body
        // part map) for all people in the image. The 'multi-person-instance'
        // algorithm returns an array of segmentation mask (or body part map).
        // Each element in the array corresponding to one of the people. In other
        // words, 'multi-person-instance' algorithm does instance-level person
        // segmentation and body part segmentation for every person in the image.
        const algorithmController =
            gui.add(guiState, 'algorithm', ['person', 'multi-person-instance']);

        // Architecture: there are a few BodyPix models varying in size and
        // accuracy.
        // The input parameters have the most effect on accuracy and speed of the
        // network
        let input = gui.addFolder('Input');

        // Updates outputStride
        // Output stride:  Internally, this parameter affects the height and width
        // of the layers in the neural network. The lower the value of the output
        // stride the higher the accuracy but slower the speed, the higher the
        // value the faster the speed but lower the accuracy.
        let outputStrideController = null;
        function updateGuiOutputStride(outputStride, outputStrideArray) {
            if (outputStrideController) {
                outputStrideController.remove();
            }
            guiState.input.outputStride = outputStride;
            outputStrideController =
                input.add(guiState.input, 'outputStride', outputStrideArray);
            outputStrideController.onChange(function (outputStride) {
                state.changingStride = true;
                guiState.input.outputStride = +outputStride;
            });
        }

        // Updates internal resolution
        // Internal resolution:  Internally, this parameter affects the height and
        // width of the layers in the neural network. The higher the value of the
        // internal resolution the better the accuracy but slower the speed.
        let internalResolutionController = null;
        function updateGuiInternalResolution(
            internalResolution,
            internalResolutionArray,
        ) {
            if (internalResolutionController) {
                internalResolutionController.remove();
            }
            guiState.input.internalResolution = internalResolution;
            internalResolutionController = input.add(
                guiState.input, 'internalResolution', internalResolutionArray);
            internalResolutionController.onChange(function (internalResolution) {
                guiState.input.internalResolution = internalResolution;
            });
        }

        // Updates depth multiplier
        // Multiplier: this parameter affects the number of feature map channels
        // in the MobileNet. The higher the value, the higher the accuracy but
        // slower the speed, the lower the value the faster the speed but lower
        // the accuracy.
        let multiplierController = null;
        function updateGuiMultiplier(multiplier, multiplierArray) {
            if (multiplierController) {
                multiplierController.remove();
            }
            guiState.input.multiplier = multiplier;
            multiplierController =
                input.add(guiState.input, 'multiplier', multiplierArray);
            multiplierController.onChange(function (multiplier) {
                state.changingMultiplier = true;
                guiState.input.multiplier = +multiplier;
            });
        }

        // updates quantBytes
        // QuantBytes: this parameter affects weight quantization in the ResNet50
        // model. The available options are 1 byte, 2 bytes, and 4 bytes. The
        // higher the value, the larger the model size and thus the longer the
        // loading time, the lower the value, the shorter the loading time but
        // lower the accuracy.
        let quantBytesController = null;
        function updateGuiQuantBytes(quantBytes, quantBytesArray) {
            if (quantBytesController) {
                quantBytesController.remove();
            }
            guiState.quantBytes = +quantBytes;
            guiState.input.quantBytes = +quantBytes;
            quantBytesController =
                input.add(guiState.input, 'quantBytes', quantBytesArray);
            quantBytesController.onChange(function (quantBytes) {
                state.changingQuantBytes = true;
                guiState.input.quantBytes = +quantBytes;
            });
        }

        function updateGuiInputSection() {
            //maskType
            if (guiState.segmentation.effect === "mask") {
                let maskTypeController = gui.add(guiState, 'maskType', ['room', 'person', 'none']);
                maskTypeController.onChange(function (mkType) {
                    maskType = mkType;
                })
            }
            if (guiState.input.architecture === 'MobileNetV1') {
                updateGuiInternalResolution(
                    defaultMobileNetInternalResolution,
                    ['low', 'medium', 'high', 'full']);
                updateGuiOutputStride(defaultMobileNetStride, [8, 16]);
                updateGuiMultiplier(defaultMobileNetMultiplier, [0.50, 0.75, 1.0])
            } else {  // guiState.input.architecture === "ResNet50"
                updateGuiInternalResolution(
                    defaultResNetInternalResolution, ['low', 'medium', 'high', 'full']);
                updateGuiOutputStride(defaultResNetStride, [32, 16]);
                updateGuiMultiplier(defaultResNetMultiplier, [1.0]);
            }
            updateGuiQuantBytes(defaultQuantBytes, [1, 2, 4]);
        }

        // Architecture: there are a few PoseNet models varying in size and
        // accuracy. 1.01 is the largest, but will be the slowest. 0.50 is the
        // fastest, but least accurate.
        architectureController =
            input.add(guiState.input, 'architecture', ['ResNet50', 'MobileNetV1']);
        guiState.architecture = guiState.input.architecture;
        architectureController.onChange(function (architecture) {
            // if architecture is ResNet50, then show ResNet50 options
            state.changingArchitecture = true;
            guiState.input.architecture = architecture;
            updateGuiInputSection();
        });

        updateGuiInputSection();
        input.open()

        const estimateController =
            gui.add(guiState, 'estimate', ['segmentation', 'partmap']);

        let segmentation = gui.addFolder('Segmentation');
        segmentation.add(guiState.segmentation, 'segmentationThreshold', 0.0, 1.0);
        const segmentationEffectController =
            segmentation.add(guiState.segmentation, 'effect', ['mask', 'bokeh']);

        let multiPersonDecoding = gui.addFolder('MultiPersonDecoding');
        multiPersonDecoding.add(
            guiState.multiPersonDecoding, 'maxDetections', 0, 20, 1);
        multiPersonDecoding.add(
            guiState.multiPersonDecoding, 'scoreThreshold', 0.0, 1.0);
        multiPersonDecoding.add(guiState.multiPersonDecoding, 'nmsRadius', 0, 30, 1);
        multiPersonDecoding.add(
            guiState.multiPersonDecoding, 'numKeypointForMatching', 1, 17, 1);
        multiPersonDecoding.add(
            guiState.multiPersonDecoding, 'refineSteps', 1, 10, 1);
        multiPersonDecoding.open();

        algorithmController.onChange(function (value) {
            switch (guiState.algorithm) {
                case 'single-person':
                    multiPersonDecoding.close();
                    singlePersonDecoding.open();
                    break;
                case 'multi-person':
                    singlePersonDecoding.close();
                    multiPersonDecoding.open();
                    break;
            }
        });

        let darknessLevel;
        let bokehBlurAmount;
        let edgeBlurAmount;
        let maskBlurAmount;
        let maskBackground;

        segmentationEffectController.onChange(function (effectType) {
            if (effectType === 'mask') {
                if (bokehBlurAmount) {
                    bokehBlurAmount.remove();
                }
                if (edgeBlurAmount) {
                    edgeBlurAmount.remove();
                }
                darknessLevel =
                    segmentation.add(guiState.segmentation, 'opacity', 0.0, 1.0);
                maskBlurAmount = segmentation.add(guiState.segmentation, 'maskBlurAmount')
                    .min(0)
                    .max(20)
                    .step(1);
                maskBackground =
                    segmentation.add(guiState.segmentation, 'maskBackground');
            } else if (effectType === 'bokeh') {
                if (darknessLevel) {
                    darknessLevel.remove();
                }
                if (maskBlurAmount) {
                    maskBlurAmount.remove();
                }
                if (maskBackground) {
                    maskBackground.remove();
                }
                bokehBlurAmount = segmentation
                    .add(
                        guiState.segmentation,
                        'backgroundBlurAmount',
                    )
                    .min(1)
                    .max(20)
                    .step(1);
                edgeBlurAmount = segmentation.add(guiState.segmentation, 'edgeBlurAmount')
                    .min(0)
                    .max(20)
                    .step(1);
            }
        });

        // manually set the effect so that the options are shown.
        segmentationEffectController.setValue(guiState.segmentation.effect);

        let partMap = gui.addFolder('Part Map');
        partMap.add(guiState.partMap, 'segmentationThreshold', 0.0, 1.0);
        partMap.add(
            guiState.partMap, 'effect', ['partMap', 'pixelation', 'blurBodyPart']);
        partMap.add(guiState.partMap, 'opacity', 0.0, 1.0);
        partMap.add(guiState.partMap, 'colorScale', Object.keys(partColorScales))
            .onChange(colorScale => {
                setShownPartColorScales(colorScale);
            });
        setShownPartColorScales(guiState.partMap.colorScale);
        partMap.add(guiState.partMap, 'blurBodyPartAmount').min(1).max(20).step(1);
        partMap.add(guiState.partMap, 'bodyPartEdgeBlurAmount')
            .min(1)
            .max(20)
            .step(1);
        partMap.open();

        estimateController.onChange(function (estimationType) {
            if (estimationType === 'segmentation') {
                segmentation.open();
                partMap.close();
                document.getElementById('colors').style.display = 'none';
            } else {
                segmentation.close();
                partMap.open();
                document.getElementById('colors').style.display = 'inline-block';
            }
        });

        gui.add(guiState, 'showFps').onChange(showFps => {
            let dom = stats.dom;
            dom.id = "showfps";
            if (showFps) {
                document.body.appendChild(dom);
            } else {
                document.body.removeChild(dom);
            }
        })
    }

    function setShownPartColorScales(colorScale) {
        const colors = document.getElementById('colors');
        colors.innerHTML = '';

        const partColors = partColorScales[colorScale];
        const partNames = bodyPix.PART_CHANNELS;

        for (let i = 0; i < partColors.length; i++) {
            const partColor = partColors[i];
            const child = document.createElement('li');

            child.innerHTML = `
        <div class='color' style='background-color:rgb(${partColor[0]},${partColor[1]},${partColor[2]})' ></div>
        ${partNames[i]}`;

            colors.appendChild(child);
        }
    }

    /**
     * Sets up a frames per second panel on the top-left of the window
     */
    function setupFPS() {
        let showfps = typeof (props.options.showFps) === "boolean" ? props.options.showFps : !isMobile();
        stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
        if (showfps) {
            let dom = stats.dom;
            dom.id = "showfps"
            document.body.appendChild(dom);
        }
    }

    async function estimateSegmentation() {
        let multiPersonSegmentation = null;
        switch (guiState.algorithm) {
            case 'multi-person-instance':
                return await state.net.segmentMultiPerson(state.video, {
                    internalResolution: guiState.input.internalResolution,
                    segmentationThreshold: guiState.segmentation.segmentationThreshold,
                    maxDetections: guiState.multiPersonDecoding.maxDetections,
                    scoreThreshold: guiState.multiPersonDecoding.scoreThreshold,
                    nmsRadius: guiState.multiPersonDecoding.nmsRadius,
                    numKeypointForMatching:
                        guiState.multiPersonDecoding.numKeypointForMatching,
                    refineSteps: guiState.multiPersonDecoding.refineSteps
                }).catch(err => {
                    // console.log('Seg Err:', err)
                });
            case 'person':
                return await state.net.segmentPerson(state.video, {
                    internalResolution: guiState.input.internalResolution,
                    segmentationThreshold: guiState.segmentation.segmentationThreshold,
                    maxDetections: guiState.multiPersonDecoding.maxDetections,
                    scoreThreshold: guiState.multiPersonDecoding.scoreThreshold,
                    nmsRadius: guiState.multiPersonDecoding.nmsRadius,
                }).catch(err => {
                    // console.log('Seg Err:', err)
                });
            default:
                break;
        };
        return multiPersonSegmentation;
    }

    async function estimatePartSegmentation() {
        switch (guiState.algorithm) {
            case 'multi-person-instance':
                return await state.net.segmentMultiPersonParts(state.video, {
                    internalResolution: guiState.input.internalResolution,
                    segmentationThreshold: guiState.segmentation.segmentationThreshold,
                    maxDetections: guiState.multiPersonDecoding.maxDetections,
                    scoreThreshold: guiState.multiPersonDecoding.scoreThreshold,
                    nmsRadius: guiState.multiPersonDecoding.nmsRadius,
                    numKeypointForMatching:
                        guiState.multiPersonDecoding.numKeypointForMatching,
                    refineSteps: guiState.multiPersonDecoding.refineSteps
                });
            case 'person':
                return await state.net.segmentPersonParts(state.video, {
                    internalResolution: guiState.input.internalResolution,
                    segmentationThreshold: guiState.segmentation.segmentationThreshold,
                    maxDetections: guiState.multiPersonDecoding.maxDetections,
                    scoreThreshold: guiState.multiPersonDecoding.scoreThreshold,
                    nmsRadius: guiState.multiPersonDecoding.nmsRadius,
                });
            default:
                break;
        };
        return multiPersonPartSegmentation;
    }

    function drawPoses(personOrPersonPartSegmentation, flipHorizontally, ctx) {
        if (Array.isArray(personOrPersonPartSegmentation)) {
            personOrPersonPartSegmentation.forEach(personSegmentation => {
                let pose = personSegmentation.pose;
                if (flipHorizontally) {
                    pose = bodyPix.flipPoseHorizontal(pose, personSegmentation.width);
                }
                drawKeypoints(pose.keypoints, 0.1, ctx);
                drawSkeleton(pose.keypoints, 0.1, ctx);
            });
        } else {
            personOrPersonPartSegmentation.allPoses.forEach(pose => {
                if (flipHorizontally) {
                    pose = bodyPix.flipPoseHorizontal(
                        pose, personOrPersonPartSegmentation.width);
                }
                drawKeypoints(pose.keypoints, 0.1, ctx);
                drawSkeleton(pose.keypoints, 0.1, ctx);
            })
        }
    }

    async function loadBodyPix() {
        toggleLoadingUI(true);
        state.net = await bodyPix.load({
            architecture: guiState.input.architecture,
            outputStride: guiState.input.outputStride,
            multiplier: guiState.input.multiplier,
            quantBytes: guiState.input.quantBytes
        });
        toggleLoadingUI(false);
    }

    /**
     * Feeds an image to BodyPix to estimate segmentation - this is where the
     * magic happens. This function loops with a requestAnimationFrame method.
     */
    function segmentBodyInRealTime() {
        const canvas = document.getElementById('output');
        // since images are being fed from a webcam

        async function bodySegmentationFrame() {
            // if changing the model or the camera, wait a second for it to complete
            // then try again.
            if (state.changingArchitecture || state.changingMultiplier ||
                state.changingCamera || state.changingStride ||
                state.changingQuantBytes) {
                console.log('load model...');
                loadBodyPix();
                state.changingArchitecture = false;
                state.changingMultiplier = false;
                state.changingStride = false;
                state.changingQuantBytes = false;
            }

            // Begin monitoring code for frames per second
            stats.begin();

            const flipHorizontally = guiState.flipHorizontal;

            switch (guiState.estimate) {
                case 'segmentation':
                    const multiPersonSegmentation = await estimateSegmentation();
                    switch (guiState.segmentation.effect) {
                        case 'mask':
                            if (multiPersonSegmentation) {
                                let bodyPixMaks = null;
                                //start
                                if (maskType === 'room') {
                                    const fgColor = { r: 0, g: 0, b: 0, a: 0 };
                                    const bgColor = { r: 127, g: 127, b: 127, a: 255 };
                                    const personPartImage = bodyPix.toMask(multiPersonSegmentation, fgColor, bgColor);
                                    bodyPixMaks = personPartImage;
                                }
                                else if (maskType === 'person') {
                                    const fgColor = { r: 127, g: 127, b: 127, a: 255 };
                                    const bgColor = { r: 0, g: 0, b: 0, a: 0 };
                                    const roomPartImage = bodyPix.toMask(multiPersonSegmentation, fgColor, bgColor);
                                    bodyPixMaks = roomPartImage;
                                }
                                else {
                                    bodyPixMaks = null;
                                }
                                //end
                                //const ctx = canvas.getContext('2d');
                                // const fgColor = { r: 0, g: 0, b: 0, a: 0 };
                                // 		const bgColor = { r: 127, g: 127, b: 127, a: 255 };
                                // const mask = bodyPix.toMask(
                                //     multiPersonSegmentation, fgColor, bgColor);

                                bodyPix.drawMask(
                                    canvas, state.video, bodyPixMaks, guiState.segmentation.opacity,
                                    guiState.segmentation.maskBlurAmount, flipHorizontally);
                                //drawPoses(multiPersonSegmentation, flipHorizontally, ctx);
                            }

                            break;
                        case 'bokeh':
                            if (multiPersonSegmentation) {
                                bodyPix.drawBokehEffect(
                                    canvas, state.video, multiPersonSegmentation,
                                    +guiState.segmentation.backgroundBlurAmount,
                                    guiState.segmentation.edgeBlurAmount, flipHorizontally);
                            }

                            break;
                    }

                    break;
                case 'partmap':
                    const ctx = canvas.getContext('2d');
                    const multiPersonPartSegmentation = await estimatePartSegmentation();
                    const coloredPartImageData = bodyPix.toColoredPartMask(
                        multiPersonPartSegmentation,
                        partColorScales[guiState.partMap.colorScale]);

                    const maskBlurAmount = 0;
                    switch (guiState.partMap.effect) {
                        case 'pixelation':
                            const pixelCellWidth = 10.0;

                            bodyPix.drawPixelatedMask(
                                canvas, state.video, coloredPartImageData,
                                guiState.partMap.opacity, maskBlurAmount, flipHorizontally,
                                pixelCellWidth);
                            break;
                        case 'partMap':
                            bodyPix.drawMask(
                                canvas, state.video, coloredPartImageData, guiState.opacity,
                                maskBlurAmount, flipHorizontally);
                            break;
                        case 'blurBodyPart':
                            const blurBodyPartIds = [0, 1];
                            bodyPix.blurBodyPart(
                                canvas, state.video, multiPersonPartSegmentation,
                                blurBodyPartIds, guiState.partMap.blurBodyPartAmount,
                                guiState.partMap.edgeBlurAmount, flipHorizontally);
                    }
                    drawPoses(multiPersonPartSegmentation, flipHorizontally, ctx);
                    break;
                default:
                    break;
            }

            // End monitoring code for frames per second
            stats.end();

            requestAnimationFrame(bodySegmentationFrame);
        }

        bodySegmentationFrame();
    }

    /**
     * Kicks off the demo.
     */
    async function bindPage() {
        // Load the BodyPix model weights with architecture 0.75
        await loadBodyPix();
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main').style.display = 'inline-block';

        let cameras = await getVideoInputs();
        setupFPS();
        setupGui(cameras);
        hidePanel(visible ? true : false)


        await loadVideo(guiState.camera);

        segmentBodyInRealTime();
    }
    const hidePanel = (type) => {
        const ui = document.getElementsByClassName("dg main a");
        const fps_ui = document.getElementById("showfps");

        if (type) {

            if (ui.length > 0) {
                const dat_ui = ui[0];
                dat_ui.style.display = "block";
                dat_ui.style.zIndex = 10000;
                dat_ui.hidden = false;
            }
            //show fps
            
            if(fps_ui !== null){
                fps_ui.style.display="block";
                fps_ui.hidden = false;
            }


        } else {

            if (ui.length > 0) {
                const dat_ui = ui[0];
                dat_ui.style.display = "none";
                dat_ui.style.zIndex = 10000;
                dat_ui.hidden = true;
            }
            if(fps_ui !== null){
                fps_ui.style.display="none";
                fps_ui.hidden = true;
            }
        }

    }

    return (<div hidden>
        <div id="stats"></div>
        <div id="info" style={{ display: 'none' }}>
        </div>
        <div id="loading" style={{ display: 'flex' }}>
            <div className="spinner-text">
                Loading BodyPix model...
    </div>
            <div className="sk-spinner sk-spinner-pulse"></div>
        </div>
        <div id='main' style={{ display: 'none' }}>
            <video id="video" playsInline style={{ display: 'none' }} hidden></video>
            <canvas id="output" />
        </div>
        <ul id="colors" style={{ display: 'none' }}></ul>

    </div>);

}