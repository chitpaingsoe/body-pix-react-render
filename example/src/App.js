import React, { useState } from 'react'

import { BodyFixView } from 'bodyfix-view'
import 'bodyfix-view/dist/index.css'




const App = () => {
  let options ={   
  
  }
  const [start,setStart] = useState(false);
  const [visible,setVisible] = useState(false);
  const [mask,setMask] = useState('person');
  const onEvent=(event)=>{
    console.log(event)
  }
  return <div style={{margin:"20px"}}>
    <button  style={{marginRight: "10px"}}  onClick={()=>{ setStart(!start)}}>{start ? "Stop" : "Start"}</button>
    <button style={{marginRight: "10px"}} onClick={()=>{ setMask("person")}}> Mask (Person)</button>
    <button style={{marginRight: "10px"}} onClick={()=>{ setMask("room")}}>Mask (Room)</button>
    <button style={{marginRight: "10px"}} onClick={()=>{ setMask("none")}}>Mask (None)</button>
    <button style={{marginRight: "10px"}} onClick={()=>{ setVisible(!visible)}}>{visible ? "Hide View" : "Show View"}</button>
    <br /> <br />
    <BodyFixView 
            start={start}
            options={options}
            onEvent={onEvent}
            maskType={mask}
            visible={visible}
  />
  </div>
}

export default App
