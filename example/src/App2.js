import React, { useState } from 'react';
import { BodyPixReactView } from 'body-pix-react-render';
import 'body-pix-react-render/dist/index.css';

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
        opacity: 0.7,
        backgroundBlurAmount: 3,
        maskBlurAmount: 0,
        edgeBlurAmount: 3
    },
    showFps: false
};


const App2 = () => {
    const [visible, setVisible] = useState(false);
    const [start, setStart] = useState(false);

    const options = {
        //your custom options
        //maskType:  "person",
        showFps: false,
        mediaOptions: {
            audio: false
        }
    }

    const onEvent = (event) => {
        if (event.event === "READY") {
            let video = document.getElementById("remoteDisplay");
            if (video !== null) {
                video.srcObject = event.stream;
                video.play();
            }
        }
    }
    return (<div>
        <button style={{ marginLeft: "100px" }} onClick={() => { setStart(!start) }} disabled={start ? true : false}>Start</button>
        <button style={{ marginLeft: "100px", marginBottom: "100px" }} onClick={() => { setVisible(!visible) }}>{visible ? "Hide View" : "Show View"}</button>
        <br /> <br />
        <BodyPixReactView options={options} visible={visible} start={start} onEvent={onEvent} />
        <br />
        <div>
            <video id="remoteDisplay" width='480px' height="360px" style={{ border: "1px solid #000" }} />
        </div>
    </div>

    );
}
export default App2;