/*
Copyright 2016 Andras Retzler <randras@sdr.hu>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Used code sample from: https://developers.google.com/youtube/iframe_api_reference
*/

/*
//How Reveal.js plugis work?
They use another design pattern for object oriented Javascript:

var MyClassInstance = window.MyClassInstance = (function(){
    //Starting with this, we alter scope: variables within will not be visible outside.
    //It is similar to putting a pair of {} in C.

    var privateVariable;
    var exposedVariable;
    //anythingToDo();
    //We can do some addEventListener() here, or anything else ==> place for contructor
    function privateFunction() { console.log("private"); }

    return({
        publicVariable: exposedVariable,
        publicFunction: function() { console.log("public"); }
    });
})();
*/

var RevealTalkVideo = (()=>{

    //local variables:
    var newSlideTimeMap = [];
    var ytPlayerCurrentSlideIndex = 0;
    var disableYTSeek = false;
    var disableRevealSeekTimeouts = 0;
    var disableSlideChanged = false;
    var videoAlreadyStarted = false;
    var ytplayer;
    var cfg = Reveal.getConfig().talkVideo;

    //setup:
    Reveal.addEventListener( 'slidechanged', ( event ) => {
        // event.previousSlide, event.currentSlide, event.indexh, event.indexv
        if(disableSlideChanged) return;
        goToSlideInYT(event.indexh,event.indexv);
    } );

    $(window).keypress((event)=>{
        if(event.which=="r".charCodeAt(0)){ Reveal.next(); recordSlideChange(); }
        if(event.which=="u".charCodeAt(0)){ Reveal.prev(); newSlideTimeMap.pop(); }
    });
    $(window).resize(ytWindowResize);

    //local functions:
    function goToSlideInYT(indexh, indexv)
    {
      if(!ytplayer||!slideTimeMap) return;
      if(disableYTSeek) return;
      slideTimeMap.forEach( (x)=>{
          if(x.slide[0]==indexh && x.slide[1]==indexv && x.slide[2]==-1 )
          {
              console.log("RevealTalkVideo :: goToSlideInYT, YT => : ", x );
              ytplayer.seekTo(x.time);
              if(ytWindowHidden || (!videoAlreadyStarted && (!( (cfg.playerAutoStart)&&!(cfg.playerAutoStartOnlyOnFirstSlide) )))) ytplayer.pauseVideo();
              disableRevealSeekTimeouts = 3;
              goToCurrentSlideInReveal(true, x.time);
              //console.log("it is", ytPlayerCurrentSlideIndex, ytplayer.getCurrentTime(), x.time);
          }
      });
    }

    function goToCurrentSlideInReveal(onlyUpdateIndex, currentYtTime) //second parameter is needed because when the video is seeked, it does not update ytplayer.getCurrentTime right then
    {
      if(!ytplayer||!slideTimeMap||!slideTimeMap.length) return;
      onlyUpdateIndex = (onlyUpdateIndex == undefined) ? false : onlyUpdateIndex;
      currentYtTime = (currentYtTime == undefined) ? ytplayer.getCurrentTime() : currentYtTime;
      var revealSlideNow = 0; //what if it is the first slide
      for(var i=0;i<slideTimeMap.length-1;i++)
          if(currentYtTime >= slideTimeMap[i].time && currentYtTime <= slideTimeMap[i+1].time)
              revealSlideNow=i;
      if(currentYtTime >= slideTimeMap[slideTimeMap.length-1].time) revealSlideNow = slideTimeMap.length-1;
      if(!onlyUpdateIndex && ytPlayerCurrentSlideIndex!=revealSlideNow) //we only change slides if the video runs on the edge between timeframes defined in slideTimeMap.
      {
          console.log("RevealTalkVideo :: goToCurrentSlideInReveal, Reveal => ", slideTimeMap[revealSlideNow] );
          //console.log("sic ", ytPlayerCurrentSlideIndex, revealSlideNow );
          disableSlideChanged = true;
          Reveal.slide.apply(this, slideTimeMap[revealSlideNow].slide);
          disableSlideChanged = false;
      }
      ytPlayerCurrentSlideIndex=revealSlideNow;
      //if(onlyUpdateIndex) console.log("sup ", ytPlayerCurrentSlideIndex );
    }

    function recordSlideChange()
    {
        newMap = {
            time: ytplayer.getCurrentTime(),
            slide: [Reveal.getState().indexh,Reveal.getState().indexv,((frag=Reveal.getState().indexf)==undefined)?-1:frag]
        };
        console.log("RevealTalkVideo :: recordSlideChange, newSlideTimeMap => ",newMap);
        newSlideTimeMap.push(newMap);
    }

    // This function creates an <iframe> (and YouTube player) the API code downloads.
    function onYouTubeIframeAPIReady()
    {
      ytplayer = new YT.Player('reveal-talkvideo-player', {
        width: cfg.playerWidth.toString(),
        height: cfg.playerHeight.toString(),
        videoId: cfg.youtubeVideoId,
        events: {
          'onReady': onPlayerReady,
          'onStateChange': () => {goToCurrentSlideInReveal();} //function inside does not have event argument
        }
      });
      ytWindowResize();
    }

    function onPlayerReady(event)
    {
        //We start playback when the video is loaded and we are on the first slide
        //else we wait for the user to start the video playback.
        if(Reveal.getState().indexh==0 && Reveal.getState().indexv==0)
        {
            if(cfg.playerAutoStart && !ytWindowHidden) event.target.playVideo();
        }
        else goToSlideInYT(Reveal.getState().indexh,Reveal.getState().indexv);

        //We will check the Youtube player every 100ms and change slides accordingly
        window.setInterval(()=>{
            if(disableRevealSeekTimeouts) { disableRevealSeekTimeouts--; return; }
            if(ytplayer.getPlayerState()!=YT.PlayerState.PLAYING) return;
            videoAlreadyStarted = true;
            //console.log(ytplayer.getCurrentTime());
            disableYTSeek = true;
            goToCurrentSlideInReveal();
            disableYTSeek = false;
        }, 100);
    }

    var ytWindowHidden = false;

    function ytWindowResize()
    {
        if(document.body.clientWidth<cfg.playerWidth*2 || document.body.clientHeight<cfg.playerHeight*2) { ytplayer.getIframe().style.display="none"; ytWindowHidden = true; }
        else if(ytplayer.getIframe().style.display) { ytplayer.getIframe().style.display=""; ytWindowHidden = false; }
    }

    return({
        //public variables and functions
        newSlideTimeMap: newSlideTimeMap,
        onYouTubeIframeAPIReady: onYouTubeIframeAPIReady,
        printNewSlideTimeMap: () =>
        {
            outStr="slideTimeMap = [\n";
            newSlideTimeMap.forEach((x)=>{outStr+=`\t\{ time: ${x.time.toFixed(2)}, slide: [ ${x.slide[0]}, ${x.slide[1]}, ${x.slide[2]}] \},\n`;});
            outStr+="];\n";
            console.log(outStr);
            return(outStr);
        },
        start: ()=>{
            $(window).load(() =>
            {   //Set up YouTube: This code loads the IFrame Player API code asynchronously.
                var tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            });
        }
    });

})();

var onYouTubeIframeAPIReady = RevealTalkVideo.onYouTubeIframeAPIReady;
RevealTalkVideo.start();
