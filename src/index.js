import React from 'react'
import styles from './styles.module.css'

export const ExampleComponent = ({ text }) => {
  return <div className={styles.test}>Example Component: {text}</div>
}
// export  {default as BodyPixView} from './body-pix-view';
export  {default as BodyPixReactView} from './body-pix-react-view';


