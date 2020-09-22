import React, { useEffect, useState } from 'react';
import * as tfjs from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

//options
const default_options = {
	loadModelOptions: {
		architecture: 'MobileNetV1',
		outputStride: 16,
		multiplier: 0.75,
		quantBytes: 2,
		algorithm: "person"
	},
	mediaOptions: {
		video: { width: 640, height: 480 }, audio: true
	},
	bodyPixOptions: {
		flipHorizontal: false,
		internalResolution: 'medium',
		segmentationThreshold: 0.7,
		maxDetections: 1,
		scoreThreshold: 0.5,
		nmsRadius: 20,
		estimate: 'segmentation',
		algorithm: "person"
	},

}

export default (props) => {
	const options = props.options || {};
	const onEvent = props.onEvent || null;
	const start = props.start || false;
	const mask = props.maskType || "room";
	const visible = props.visible || false;

	let localVideo = document.getElementById('local_video');
	let canvas = document.getElementById('canvas');


	const [localStream,setLocalStream] = useState(null);
	const [canvasStream,setCanvasStream] = useState(null);
	let maskType =  mask;
	let bodyPixNet = null;
	let animationId = null;
	let contineuAnimation = false;
	let bodyPixMaks = null;
	let segmentTimerId = null;

	useEffect(() => {
		localVideo = document.getElementById('local_video');
		canvas = document.getElementById('canvas');
		

	}, [])

	useEffect(() => {
		if (start === true) {
			(async function load() {
				localVideo = document.getElementById('local_video');
				canvas = document.getElementById('canvas');				
				await loadModel();
				await startVideo();
			})();
		} else {
			stopVideo();

		}
	}, [start])
	useEffect(()=>{
		if(localStream){
			(async function load() {				
				stopVideo();
				await loadModel();
				await startVideo();
			})();
		}
	},[mask])


	// ------- bodypix -------
	async function loadModel() {
		const net = await bodyPix.load(addOptions(options.loadModelOptions, "loadModel"));
		bodyPixNet = net;
		console.log('bodyPix ready');

	}


	const updateSegment = () => {
		const segmeteUpdateTime = 10; // ms
		if (!bodyPixNet) {
			console.warn('bodyPix net NOT READY');
			return;
		}

		const option = addOptions(options.bodyPixOptions, "bodyPix");

		if (maskType === 'none') {
			bodyPixMaks = null;
			if (contineuAnimation) {
				segmentTimerId = setTimeout(updateSegment, segmeteUpdateTime);
			}
			return;
		}
		
		bodyPixNet.segmentPerson(localVideo, option)
			.then(segmentation => {
				if (maskType === 'room') {
					const fgColor = { r: 0, g: 0, b: 0, a: 0 };
					const bgColor = { r: 127, g: 127, b: 127, a: 255 };
					const personPartImage = bodyPix.toMask(segmentation, fgColor, bgColor);
					bodyPixMaks = personPartImage;
				}
				else if (maskType === 'person') {
					const fgColor = { r: 127, g: 127, b: 127, a: 255 };
					const bgColor = { r: 0, g: 0, b: 0, a: 0 };
					const roomPartImage = bodyPix.toMask(segmentation, fgColor, bgColor);
					bodyPixMaks = roomPartImage;
				}
				else {
					bodyPixMaks = null;
				}

				if (contineuAnimation) {
					segmentTimerId = setTimeout(updateSegment, segmeteUpdateTime);
				}
			})
			.catch(err => {
				//console.error('segmentPerson ERROR:', err);
				
			})
	}

	const startCanvasVideo = () => {
		writeCanvasString('initalizing BodyPix');
		contineuAnimation = true;
		animationId = window.requestAnimationFrame(updateCanvas);
		setCanvasStream(canvas.captureStream());

		updateSegment();
	}

	const writeCanvasString = (str) => {
		const ctx = canvas.getContext('2d');
		ctx.font = "64px serif";
		ctx.fillText(str, 5, 100);
		console.log(str);
	}

	const stopCanvasVideo = () => {
		//clear canvas
		const context = canvas.getContext('2d');

		context.clearRect(0, 0, canvas.width, canvas.height);

		// 

		contineuAnimation = false;
		if (segmentTimerId) {
			clearTimeout(segmentTimerId);
			segmentTimerId = null;
		}

		if (canvasStream) {
			canvasStream.getTracks().forEach(track => {
				console.log('stop canvas track:', track);
				track.stop();
			});
			setCanvasStream(null);
		}

	}
	const stopStreams = () =>{
		if (canvasStream) {
			canvasStream.getTracks().forEach(track => {
				console.log('stop canvas track:', track);
				track.stop();
			});
			setCanvasStream(null);
		}
		if (localStream) {
			localStream.getTracks().forEach(track => {
				console.log('stop track:', track);
				track.stop();
			});
			setLocalStream(null)
		}
	}

	const updateCanvas = () => {
		drawCanvas(localVideo);
		if (contineuAnimation) {
			animationId = window.requestAnimationFrame(updateCanvas);
		}
	}

	const drawCanvas = (srcElement) => {
		const opacity = 1.0;
		let flipHorizontal = false;
		if (options.bodyPixOptions) {
			if (typeof (options.bodyPixOptions)) {
				if ('flipHorizontal' in options.bodyPixOptions) {
					flipHorizontal = options.bodyPixOptions.flipHorizontal;
				}
			}
		}

		//const maskBlurAmount = 0;
		const maskBlurAmount = 3;

		// Draw the mask image on top of the original image onto a canvas.
		// The colored part image will be drawn semi-transparent, with an opacity of
		// 0.7, allowing for the original image to be visible under.
		bodyPix.drawMask(
			canvas, srcElement, bodyPixMaks, opacity, maskBlurAmount,
			flipHorizontal
		);
	}

	// -------- user media -----------

	async function startVideo() {
		const mediaConstraints = addOptions(options.mediaOptions, "media");

		let localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints).catch(err => {
			console.error('media ERROR:', err);
			return;
		});
		setLocalStream(localStream);

		localVideo.srcObject = localStream;
		await localVideo.play().catch(err => console.error('local play ERROR:', err));

		startCanvasVideo();

		if (onEvent) {
			if (!bodyPixNet) {
				onEvent({
					event: "NOT_READY",
					stream: null
				})
			} else {
				onEvent({
					event: "READY",
					stream: canvas.captureStream()
				})
			}
		}

	}

	const stopVideo = () => {
		
		stopCanvasVideo();

		localVideo.pause();
		localVideo.srcObject = null;
		if (localStream) {
			localStream.getTracks().forEach(track => {
				console.log('stop track:', track);
				track.stop();
			});
			setLocalStream(null)
		}

	}




	const addOptions = (input, optionType) => {
		if (input === undefined || input === null) {
			switch (optionType) {
				case "media":
					return default_options.mediaOptions;

				case "loadModel":
					return default_options.loadModelOptions;

				case "bodyPix":
					return default_options.bodyPixOptions;

				default:
					return {};
			}
		}
		let keys = Object.keys(input);
		switch (optionType) {
			case "media":
				let mediaOptions = default_options.mediaOptions;
				if (input.audio) mediaOptions.audio = input.audio;
				if (input.video.width) mediaOptions.video.width = input.video.width;
				if (input.video.height) mediaOptions.video.height = input.video.height;
				return mediaOptions;

			case "loadModel":
				let modelOptions = default_options.loadModelOptions;
				if (keys.length > 0) {
					(keys).forEach(key => {
						if (input[key]) {
							modelOptions[key] = input[key];
						}
					});
				}
				return modelOptions;
			case "bodyPix":
				let bodyPixOptions = default_options.bodyPixOptions;
				if (keys.length > 0) {
					(keys).forEach(key => {
						if (input[key]) {
							bodyPixOptions[key] = input[key];
						}
					});
				}
				return bodyPixOptions;

			default:
				return {};
		}
	}
	
	return (
		<div hidden={visible ? false : true}>

			<div style={{ display: "grid", gridTemplateRows: "1fr", gridTemplateColumns: "170px 170px" }}>
				<div style={{ gridColumn: 1 }}>
					local video<br />
					<video id="local_video" width="640px" height="480px"  hidden={visible ? false : true}
						style={{ border: "solid black 1px", width: "160px", height: "120px" }}></video>
				</div>
				<div style={{ gridColumn: 2 }}>
					masked video<br />
					<canvas id="canvas" width="640px" height="480px" style={{ border: "solid 1px black", width: "160px", height: "120px" }}  hidden={visible ? false : true} />
				</div>
			</div>

		</div>
	);
}
