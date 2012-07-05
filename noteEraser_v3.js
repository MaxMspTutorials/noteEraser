//Original
autowatch = 1;
inlets = 1;
outlets = 2;
var debugToggle = "post";
function debug(debugString) {
    if (debugToggle === false) {
    return;
    }
    if (debugToggle === "post") {
        post(debugString);
        post();
    }
    else if (debugToggle === "outlet") {
        outlet(0,debugString);
    }
}
function debugMode(val) {
    debugToggle = val;
}
function delquote(str){
	return (str=str.replace(/""/g,''));
} 

//our Midi Clip functions

function removeAllClipNotes(liveObject) {
    liveObject.call("select_all_notes");
    liveObject.call('replace_selected_notes');
    liveObject.call("notes",0);
    liveObject.call("done");
    outlet(1,"padall set");
}

function getClipNotes(liveObject) {
    tempNoteArray = new Array();
    routeList = new Array();
    liveObject.call("select_all_notes");
    var selectedNotes = liveObject.call("get_selected_notes");
    liveObject.call("deselect_all_notes");
    for (j = 2; j < (selectedNotes[1] * 6); j = j+6) {
        tempArray = selectedNotes.slice(j, j+6);
        tempArray[2] = Number(tempArray[2]).toFixed(3) * 1; //FUCK YOU JS
        tempArray[3] = Number(tempArray[3]).toFixed(3) * 1;
        tempNoteArray.push(tempArray);
        if (routeList.indexOf(selectedNotes[j+1]) === -1) {
            routeList.push(selectedNotes[j+1]);
            //debug("New midiValue " + selectedNotes[j+1]);
        }
    }
    outlet(1,"padall", "set");    
    for (i = 0; i < routeList.length; i++) {
        outlet(1,"pad"+i,"set",routeList[i]);
    }
    //liveObject.call("done");    
    return tempNoteArray;
}
function updateClipNotes(liveObject,clipNotes) {
    liveObject.call("select_all_notes");
    liveObject.call('replace_selected_notes');
    liveObject.call("notes",0);
    liveObject.call("done");  
    liveObject.call("select_all_notes");
    liveObject.call("replace_selected_notes");
    liveObject.call("notes", clipNotes.length);
    for (i = 0; i<clipNotes.length; i++) {
        liveObject.call(clipNotes[i][0],clipNotes[i][1],Number(clipNotes[i][2]).toFixed(3),Number(clipNotes[i][3]).toFixed(3),clipNotes[i][4],clipNotes[i][5]);
    }
    liveObject.call("deselect_all_notes");
    liveObject.call("done");
}
function postArray(arrayToPost) {
    debug("Array:\n");
    debug("=======================");
    for (i = 0; i < arrayToPost.length; i++) {
        debug("index "+i+": " + arrayToPost[i]);
    }
    debug("=======================");    
}
//our variables to hold the Device, Track and our fired clip
var thisDevice;
var thisTrack;
var thisTrackPath;
var firedClip;
var loopJump;
var noteArray = new Array();
var noteArrayCache = new Array();
var muteArray = new Array(16);
var mutePage = 1;
var muteMode = "erase";
var routeList = new Array();
var updateToggle = 0;

//and our callback functions
function thisTrackCallback(args) {
    if (args[0] === "fired_slot_index") {
        if (args[1] > -1) {
            var clipPath = thisTrackPath.concat(" clip_slots " +args[1] +" clip");          
            firedClip.path = clipPath;
            loopJump.path = clipPath;
            //debug("changed firedClip path");
        }
    }
}
function firedClipCallback(args) {
    if(args[0]==="id") {
     //means our clip changed
        //debug("Fired clip called w/ id " + args[1]);
        noteArray = getClipNotes(firedClip);
        outlet(0,"set",firedClip.get("name"));
    }
    if (args[0] === "notes") {
        updateToggle = 1;
        debug("Fired clip's notes changed, updatetoggle Changed to 1");
    
    }
    if (args[0] === "loop_jump") {
        //debug("Loop has ended at time: " + firedClip.get("loop_end") + " with args" + args[1]);
        if (updateToggle === 1) {
            //debug("We auto-updated");
            updateToggle = 0;
            noteArray = getClipNotes(firedClip);
        }
        else if (updateToggle === 0) {
            //debug("We loop jumped but didn't update");
        }
    }
    
}

function init() {
    thisDevice = new LiveAPI(this.patcher, "live_set","this_device");
    thisTrackPath = thisDevice.path.split(' ');
    thisTrack = new LiveAPI(this.patcher, thisTrackCallback, "live_set", "tracks", thisTrackPath[2]);
    thisTrack.property = "fired_slot_index";
    thisTrackPath = delquote(thisTrack.path);
    firedClip = new LiveAPI(this.patcher, firedClipCallback, "live_set view detail_clip");
    firedClip.mode = 1;
    firedClip.property = "notes";
    loopJump = new LiveAPI(this.patcher, firedClipCallback, "live_set view detail_clip");
    loopJump.mode = 1;
    loopJump.property = "loop_jump";    
}

function pullNotes() {
    noteArray = getClipNotes(firedClip);
}
function pushNotes() {
    updateClipNotes(firedClip,noteArray);
}
function postNotes() {
    postArray(noteArray);
    postArray(routeList);
}
function eraseNotes(noteNum, start, end, arrayCopy) {
    arrayToErase = arrayCopy;
    tempArray = new Array();
      for (i = 0; i < arrayToErase.length; i++) {
          if (arrayToErase[i][1] === noteNum) {
              if (start < Number(arrayToErase[i][2] + arrayToErase[i][3])) {
                  //debug("muteStart is before clipEnd");
                  if (end > Number(arrayToErase[i][2])) {
                      //debug("muteEnd is after clipStart");
                      //debug("...so we should probably mute it");
                      if (muteMode === "erase") {
                          tempArray.push(arrayToErase.splice(i,1)); 
                      }
                      else if (muteMode === "mute") {
                      }
                  }
              }
          }
      }
      postNotes();

    noteArrayCache = tempArray;
    return arrayToErase;
}
function mute(mutenum, toggle) {
    var thisposition = firedClip.get("playing_position");
    //debug("mute: "+routeList[mutenum] + " " + toggle);
    if (toggle === 1) {
        muteArray[mutenum] = thisposition;
    }
    if (toggle === 0 && muteArray[mutenum] != null) {
        noteArray = eraseNotes(routeList[mutenum],muteArray[mutenum],thisposition, noteArray);
        updateClipNotes(firedClip,noteArray);
        //debug("calling eraseNotes w/ args " + mutenum + " - " + muteArray[mutenum]  + " - " + thisposition);
        muteArray[mutenum] = null;
    }
}
function muteAll() {
    for (i = 0; i < muteArray.length; i++) {
        if (muteArray[i] != null) {
            eraseNotes(routeList[i],muteArray[i],firedClip.get("loop_end"),noteArray);
            muteArray[i] = Number("0.0").toFixed(2);
        }
    }
}
function mode(modeVal) {
    if (modeVal === "mute") {
        muteMode = "mute";
    }
    else if (modeVal === "erase") {
        muteMode = "erase";
    }
}
