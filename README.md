# body-pix-react-render

> Custom Body-Pix React Render

[![NPM](https://img.shields.io/npm/v/body-pix-react-render.svg)](https://www.npmjs.com/package/body-pix-react-render) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save body-pix-react-render
```

## Usage

```jsx
import React, { useState } from 'react';
import { BodyPixView } from 'body-pix-react-render';
import 'body-pix-react-render/dist/index.css';

//default options
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

const App = () => {
  let options = {
      //your custom options
  }
  const [start, setStart] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mask, setMask] = useState('person');
  const onEvent = (event) => {
    console.log(event)
  }
  return <div style={{ margin: "20px" }}>
    <button style={{ marginRight: "10px" }} onClick={() => { setStart(!start) }}>{start ? "Stop" : "Start"}</button>
    <button style={{ marginRight: "10px" }} onClick={() => { setMask("person") }}> Mask (Person)</button>
    <button style={{ marginRight: "10px" }} onClick={() => { setMask("room") }}>Mask (Room)</button>
    <button style={{ marginRight: "10px" }} onClick={() => { setMask("none") }}>Mask (None)</button>
    <button style={{ marginRight: "10px" }} onClick={() => { setVisible(!visible) }}>{visible ? "Hide View" : "Show View"}</button>
    <br /> <br />
    <BodyPixView
      start={start}
      options={options}
      onEvent={onEvent}
      maskType={mask}
      visible={visible}
    />
  </div>
}

export default App
```

## License

MIT © [Chit Paing Soe](https://github.com/chitpaingsoe)
