import './App.css';
import packageInfo from '../package.json';
import * as Tone from "tone"
import {useEffect, useState, useRef} from "react";
import {
  Backdrop,
  Button,
  CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle,
  Grid,
  LinearProgress, MenuItem, Select,
  ThemeProvider
} from "@mui/material";
import { createTheme } from '@mui/material/styles';


const version = packageInfo.version;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
  // typography: { // has no effect on the size, only letters in buttons
  //     fontSize: 8,
  // },
});

function App() {

  const getStoredPieceIndex = () => {
    const key = "ULP_pieceIndex";
    const value = localStorage.hasOwnProperty(key) ?  parseInt(localStorage.getItem(key)) : 0;
    return value;
  }

  const [playbackData, setPlayBackData] = useState(null);
  const [time, setTime] = useState(0);
  const [pieceIndex, setPieceIndex] = useState(getStoredPieceIndex()); // index to the selected piece in tracks.json
  const [pieceInfo, setPieceInfo] = useState({title:"", duration:0, versionName:"", versions:0});
  const [timerID, setTimerID] = useState(0);

  const [counter, setCounter] = useState(  0 );
  const [hasListenedAll, setHasListenedAll] = useState(false);
  const [userTouched, setUserTouched]  = useState(false);

  const resumeAudio = () => {
    Tone.getContext().resume();
    console.log("Audio resume");
    setUserTouched(true);
    preparePlayback(pieceIndex, counter);
  }

  // TODO: pack into one object playInfo, that is set be preparePlayback
  // const duration = playbackData ? playbackData[pieceIndex].duration : 0;
  // const title = playbackData ? playbackData[pieceIndex].title : "";
  // const versionName = playbackData ? playbackData[pieceIndex].playList[counter].name : "";
  // const versions = playbackData ? playbackData[pieceIndex].playList.length : 0;

  useEffect( ()=>{
    fetch(process.env.PUBLIC_URL + "/tracks.json")
        .then((res) => res.json())
        .then((data) => {
          setPlayBackData(data);
          console.log("Loaded json object: ", data);
          init(data, pieceIndex);

        })
  }, [] );

  const init = (data, index) => {
    const counter = getStoredCounter(data[index].uid);
    console.log("Found counter for ", counter, data[index].uid);
    if (counter === data[pieceIndex].playList.length-1) {
      lastTimeReaction();
    }
    preparePlayback(index, counter);
    setCounter(counter);
    setPieceIndex(index);
    storePieceIndex(index);
  }

  const getStoredCounter = (uid) => {
    const key = "ULP_"+uid;
    const value = localStorage.hasOwnProperty(key) ?  parseInt(localStorage.getItem(key)) : 0;
    return value;
  }

  const setStoredCounter = (uid, value) => {
    const key = "ULP_"+uid;
    return localStorage.setItem(key, value.toString());
  }



  const storePieceIndex = (index) => localStorage.setItem("ULP_pieceIndex", index.toString());

  const createChannel = (volume, pan) => {
    const channel = new Tone.Channel({ channelCount:2, volume:volume, pan:pan}).toDestination();
    return channel;
  }

  const createPlayer = (soundFile, loop=false, delay=0) => {
    const source = process.env.PUBLIC_URL + "/sounds/" + soundFile;
    console.log("Source: ", source);
    const newPlayer = new Tone.Player({
      url: source,
      loop: loop,
      // onload: () => {
      //     console.log("Local onload -  loaded", soundFile);
      // }
    }).sync().start(delay); // not sure if offsetcan be handles this way
    return newPlayer;
  }

  const loadResources = (event) => {
    if (!playbackData) {console.log("No playBackData"); return; }
    dispose(pieceIndex, counter);
    const index = event.target.value;
    console.log("Should set  piece to: ", index, playbackData[index].title);
    stop(); // for any case

    setTimeout( ()=>{
      init(playbackData,index)
    }, 200); // give some time to stop

  }

  const getSoundfile = (name, piece=pieceIndex) => {
    if (!playbackData) return;
    const trackInfo =     playbackData[piece].tracks.find( (track) => track.name===name );
    if (!trackInfo) {
      console.log("TrackInfo not found for:", name, playbackData[piece].title);
      return "";
    } else {
      return trackInfo.soundFile;
    }
  }

  const dispose = (pieceIndex=0, playListIndex=0) => {
    // release old tracks
    const playList = playbackData[pieceIndex].playList[playListIndex];
    if (playList) {
      for (let track of playList.tracks) {
        if (track.hasOwnProperty("channel")) {
          console.log("Trying to dispose: ", track.name);
          if (track.channel) track.channel.dispose();
          if (track.player) track.player.dispose();
        }
      }
    }
  }

  const preparePlayback = (pieceIndex=0, playListIndex=0) => { // index to piece  later: take it from pieceIndex
    if (!playbackData) return;
    console.log("preparePlayback", pieceIndex, playListIndex);

    setPieceInfo({
      title:playbackData[pieceIndex].title,
      duration:playbackData[pieceIndex].duration,
      versionName:playbackData[pieceIndex].playList[playListIndex].name,
      versions: playbackData[pieceIndex].playList.length } );

    // release old tracks
    dispose(pieceIndex, counter); // clear old buffers

    const activeTracks = playbackData[pieceIndex].playList[playListIndex].tracks;
    console.log("Should start playing: ", activeTracks);
    for (let track of activeTracks) {
      const soundFile = getSoundfile(track.name, pieceIndex);
      if (soundFile) {
        track.channel = createChannel(track.volume, track.pan);
        track.player = createPlayer(soundFile);
        track.player.connect(track.channel);
      }
    }
  }

  const lastTimeReaction = () => {
    console.log("This was the last available version. Now you can choose whichever you want");
    setHasListenedAll(true);
  }

  const start = () => {
    console.log("Start");
    Tone.Transport.start("+0.1"); // is this necessary
    const id =  Tone.Transport.scheduleRepeat(() => {
      setTime(Math.floor(Tone.Transport.seconds));
      console.log("Duration: ", pieceInfo.duration);
      if (Tone.Transport.seconds>pieceInfo.duration && Tone.Transport.state==="started") {
        stop();
        const newCounter = counter + 1;
        console.log("Counter now: ", newCounter, counter);
        if (newCounter < playbackData[pieceIndex].playList.length) {
          setStoredCounter(playbackData[pieceIndex].uid, newCounter);
          setCounter(newCounter);
          //localStorage.setItem("LayerPlayerListeningCounter", newCounter.toString());
          setTimeout( ()=>{
            preparePlayback(pieceIndex, newCounter); // this should be actually in effect on pieceIndex, counter
          }, 200); // give some time to stop
        } else {
          lastTimeReaction();
          console.log("Counter would be out of range: ", counter, playbackData[pieceIndex].playList.length) ;
        }
      }
    }, 1);
    console.log("Created timer: ", id);
    setTimerID(id);
  }

  const pause = () => {
    Tone.Transport.toggle("+0.01");
  }

  const stop = () => {
    console.log("Stop");
    Tone.Transport.stop("+0.05");
    //Tone.Transport.cancel("+0.1"); // do we need this?
    Tone.Transport.clear(timerID);
    setTime(0);
  }


  //const selectRef = useRef();

  const createPlaylistSelection = () => {

    return playbackData && (
        <div>
          Select version:
        <Select value={counter} onChange={ (event) => {
          const index = event.target.value;
          preparePlayback(pieceIndex, index);
          setCounter(index);
        }}>
          {playbackData[pieceIndex].playList.map((list, index) => <MenuItem key={"playlistMenu" + index}
                                                        value={index}>{list.name}</MenuItem>)}
        </Select>
        </div>
    )
  }


  return (
      <ThemeProvider theme={darkTheme}>
        <div className="App">
          <header className="App-header">
            <h1>U: layer-player test</h1>
            <p><small>Version {version}</small></p>
            {!userTouched ?
                <div><Button onClick={()=>resumeAudio()}> Start and enable audio</Button></div>
                :
                <div>
                  {playbackData &&  <div>Select piece:
                    <Select value={pieceIndex} onChange={loadResources}>
                      {playbackData.map((piece, index) => <MenuItem key={"pieceMenu" + index}
                                                                    value={index}>{piece.title}</MenuItem>)}
                    </Select>
                  </div>}
                  <p>Piece: {pieceInfo.title}, duration: {pieceInfo.duration} s, versions: {pieceInfo.versions}</p>
                  {hasListenedAll &&
                  <div><b>You have listened to all available versions. Thank you!</b><br />
                    Now you can select the vresion you want to hear: {createPlaylistSelection()}
                  </div>}
                  <p>Youre will listen/are listing this piece for <b>{counter + 1}.</b> time</p>
                  {pieceInfo.versionName && <p>Version name: {pieceInfo.versionName}</p>}
                  <br/>
                  <Button onClick={() => start()}>Start</Button>
                  <Button onClick={() => pause()}>Pause</Button>
                  <Button onClick={() => stop()}>Stop</Button>
                  Time: {time}

                </div>
            }

          </header>

        </div>
      </ThemeProvider>
  );
}

export default App;
