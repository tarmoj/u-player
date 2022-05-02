import './App.css';
import packageInfo from '../package.json';
import * as Tone from "tone"
import {useEffect, useState} from "react";

const version = packageInfo.version;


function App() {

  const [playbackData, setPlayBackData] = useState(null);
  const [time, setTime] = useState(0);
  const [pieceIndex, setPieceIndex] = useState(1); // index to the selected piece in tracks.json

  const [counter, setCounter] = useState( localStorage.hasOwnProperty("LayerPlayerListeningCounter") ?
      parseInt(localStorage.getItem("LayerPlayerListeningCounter")) : 0 );
  const [hasListenedAll, setHasListenedAll] = useState(false);
  const [userTouched, setUserTouched]  = useState(false);

  const resumeAudio = () => {
    Tone.getContext().resume();
    console.log("Audio resume");
    setUserTouched(true);
    preparePlayback(pieceIndex, counter);
  }

  // TODO: pack into one object playInfo, that is set be preparePlayback
  const duration = playbackData ? playbackData[pieceIndex].duration : 0;
  const title = playbackData ? playbackData[pieceIndex].title : "";
  const versionName = playbackData ? playbackData[pieceIndex].playList[counter].name : "";
  const versions = playbackData ? playbackData[pieceIndex].playList.length : 0;

  useEffect( ()=>{
    fetch(process.env.PUBLIC_URL + "/tracks.json")
        .then((res) => res.json())
        .then((data) => {
          setPlayBackData(data);
          console.log("Loaded json object: ", data);
          if (counter === data[pieceIndex].playList.length) {
            lastTimeReaction();
          }
          preparePlayback(pieceIndex, counter);
        })
  }, [] );

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
    const index = event.target.value;
    console.log("Should set  piece to: ", index, playbackData[index].title);
    stop(); // for any case
    setTimeout( ()=>{
      preparePlayback(index);
      setPieceIndex(index);
    }, 200); // give some time to stop

  }

  const getSoundfile = (name) => {
    if (!playbackData) return;
    const trackInfo =     playbackData[pieceIndex].tracks.find( (track) => track.name===name );
    if (!trackInfo) {
      console.log("TrackInfo not found for:", name);
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

    // release old tracks
    dispose(pieceIndex, counter); // clear old buffers

    const activeTracks = playbackData[pieceIndex].playList[playListIndex].tracks;
    console.log("Should start playing: ", activeTracks);
    for (let track of activeTracks) {
      const soundFile = getSoundfile(track.name);
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
    Tone.Transport.scheduleRepeat(() => {
      setTime(Math.floor(Tone.Transport.seconds));
      if (Tone.Transport.seconds>duration && Tone.Transport.state==="started") {
        stop();
        const newCounter = counter + 1;
        console.log("Counter now: ", newCounter);
        if (newCounter < playbackData[pieceIndex].playList.length) {
          localStorage.setItem("LayerPlayerListeningCounter", newCounter.toString());
          setTimeout( ()=>{
            preparePlayback(pieceIndex, newCounter); // this should be actually in effect on pieceIndex, counter
            setCounter(newCounter);
          }, 200); // give some time to stop
        } else {
          lastTimeReaction();
          console.log("Counter would be out of range: ", counter, playbackData[pieceIndex].playList.length) ;
        }
      }
    }, 1);
  }

  const pause = () => {
    Tone.Transport.pause("+0.01");
  }

  const stop = () => {
    console.log("Stop");
    Tone.Transport.stop("+0.05");
    Tone.Transport.cancel(0.1); // do we need this?
    setTime(0);
  }




  return (
    <div className="App">
      <header className="App-header">
        <h1>U: layer-player test</h1>
        <p><small>Version {version}</small></p>
        {!userTouched ?
            <div><button onClick={()=>resumeAudio()}> Start and enable audio</button></div>
            :
            <div>
              <p>Piece: {title}, duration: {duration} s, versions: {versions}</p>
              {hasListenedAll && <div><b>You have listened to all available versions. Thank you!</b></div>}
              <p>Youre will listen/are listing this piece for <b>{counter + 1}.</b> time</p>
              {versionName && <p>Version name: {versionName}</p>}
              <br/>
              <button onClick={() => start()}>Start</button>
              <button onClick={() => pause()}>Pause</button>
              <button onClick={() => stop()}>Stop</button>
              Time: {time}

            </div>
        }

      </header>

    </div>
  );
}

export default App;
