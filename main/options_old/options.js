/*
 Copyright (c) 2017 amano <amano@miku39.jp>

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

let Options = {
    defaultValue: {},

    /**
     * 読み上げテスト
     */
    testTalk: function(){
        let text = $( '#webspeech-test-text' ).val();
        console.log( text );
        NicoLiveTalker.speech( text );
    },

    initTalkerUI: function(){
        NicoLiveTalker.init();

        let voice_select = $( '#webspeech-select-voice' );

        // 音声キャラクタリストを作成
        this._webvoices = speechSynthesis.getVoices();
        for( let i = 0; i < this._webvoices.length; i++ ){
            let item = document.createElement( 'option' );
            item.setAttribute( 'value', i );
            item.appendChild( document.createTextNode( this._webvoices[i].name ) );
            voice_select.append( item );
        }

        // 設定をUIに反映
        $( '#do-speech' ).prop( 'checked', Config.speech.do_speech );
        voice_select.val( Config.speech.speech_character_index );

        $( '#btn-test-talk' ).on( 'click', ( ev ) =>{
            this.testTalk();
        } );
    },

    initTwitterUI: function(){
        // 認証済みのスクリーン名
        if( Twitter.getScreenName() ){
            $( '#twitter-screen-name' ).text( "@" + Twitter.getScreenName() );
        }

        $( '#twitter-live_started' ).val( Config.twitter.live_started );
        $( '#twitter-play_started' ).val( Config.twitter.play_started );
        $( '#twitter-tweet_live_started' ).prop( 'checked', Config.twitter.tweet_live_started );
        $( '#twitter-tweet_play_started' ).prop( 'checked', Config.twitter.tweet_play_started );

        // PINを取得
        $( '#btn-twitter-get-pin' ).on( 'click', ( ev ) =>{
            Twitter.getRequestToken();
        } );

        // 認証
        $( '#btn-twitter-auth' ).on( 'click', ( ev ) =>{
            let pin = $( '#txt-twitter-pin' ).val();
            // console.log(pin);
            Twitter.getAccessToken( pin );
        } );

        // つぶやきテスト
        $( '#btn-test-tweet' ).on( 'click', ( ev ) =>{
            let text = $( '#txt-tweet-test' ).val();
            this.updateStatus( text );
        } );
    },

    initResponseUI: function(){
        $( '#accept_request' ).val( Config.response.accept_request );
        $( '#not_accept_request' ).val( Config.response.not_accept_request );
        $( '#deleted_video' ).val( Config.response.deleted_video );
        $( '#fresh_video' ).val( Config.response.fresh_video );
        $( '#already_played' ).val( Config.response.already_played );
        $( '#already_requested' ).val( Config.response.already_requested );
        $( '#no_live_play' ).val( Config.response.no_live_play );
        $( '#ng_video' ).val( Config.response.ng_video );
    },

    initRequestUI: function(){
        $( '#reply_comment' ).prop( 'checked', Config.request.reply_comment );
        $( '#allow_duplicate' ).prop( 'checked', Config.request.allow_duplicate );
        $( '#disallow_fresh_video' ).prop( 'checked', Config.request.disallow_fresh_video );
        $( '#allow_already_played_video' ).prop( 'checked', Config.request.allow_already_played_video );
    },

    initVideoInfoUI: function(){
        $( '#videoinfo-interval' ).val( Config.videoinfo.interval );

        $( '#vinfo-command-1' ).val( Config.videoinfo.command[0] );
        $( '#vinfo-command-2' ).val( Config.videoinfo.command[1] );
        $( '#vinfo-command-3' ).val( Config.videoinfo.command[2] );
        $( '#vinfo-command-4' ).val( Config.videoinfo.command[3] );
        $( '#vinfo-comment-1' ).val( Config.videoinfo.comment[0] );
        $( '#vinfo-comment-2' ).val( Config.videoinfo.comment[1] );
        $( '#vinfo-comment-3' ).val( Config.videoinfo.comment[2] );
        $( '#vinfo-comment-4' ).val( Config.videoinfo.comment[3] );

        $( '#vinfo-play-failed' ).val( Config.videoinfo.failed );
    },

    storeSettings: function(){
        // 表示
        Config.show_description = !!$( '#show-details' ).prop( 'checked' );

        // 動画情報
        Config.videoinfo.interval = $( '#videoinfo-interval' ).val();
        Config.videoinfo.command[0] = $( '#vinfo-command-1' ).val();
        Config.videoinfo.command[1] = $( '#vinfo-command-2' ).val();
        Config.videoinfo.command[2] = $( '#vinfo-command-3' ).val();
        Config.videoinfo.command[3] = $( '#vinfo-command-4' ).val();
        Config.videoinfo.comment[0] = $( '#vinfo-comment-1' ).val();
        Config.videoinfo.comment[1] = $( '#vinfo-comment-2' ).val();
        Config.videoinfo.comment[2] = $( '#vinfo-comment-3' ).val();
        Config.videoinfo.comment[3] = $( '#vinfo-comment-4' ).val();
        Config.videoinfo.failed = $( '#vinfo-play-failed' ).val();

        // リクエスト
        Config.request.reply_comment = !!$( '#reply_comment' ).prop( 'checked' );
        Config.request.allow_duplicate = !!$( '#allow_duplicate' ).prop( 'checked' );
        Config.request.disallow_fresh_video = !!$( '#disallow_fresh_video' ).prop( 'checked' );
        Config.request.allow_already_played_video = !!$( '#allow_already_played_video' ).prop( 'checked' );
        Config.request.ng_video = $( '#ng-video-list' ).val();

        // 運営コメント
        Config.response.accept_request = $( '#accept_request' ).val();
        Config.response.not_accept_request = $( '#not_accept_request' ).val();
        Config.response.deleted_video = $( '#deleted_video' ).val();
        Config.response.fresh_video = $( '#fresh_video' ).val();
        Config.response.already_played = $( '#already_played' ).val();
        Config.response.already_requested = $( '#already_requested' ).val();
        Config.response.no_live_play = $( '#no_live_play' ).val();
        Config.response.ng_video = $( '#ng_video' ).val();

        // コメント
        Config.comment.comment184 = !!$( '#comment-184' ).prop( 'checked' );
        Config.comment.autokotehan = !!$( '#comment-autokotehan' ).prop( 'checked' );
        Config.comment.display_lines = $( '#comment-display-num' ).val();
        Config.comment.history_lines_on_connect = $( '#comment-backlog-num' ).val();
        Config.comment.autocomplete = $( '#comment-autocomplete' ).val();

        // コメント読み上げ
        Config.speech.do_speech = !!$( '#do-speech' ).prop( 'checked' );
        Config.speech.speech_character_index = $( '#webspeech-select-voice' ).val();

        // つぶやき
        Config.twitter.live_started = $( '#twitter-live_started' ).val();
        Config.twitter.play_started = $( '#twitter-play_started' ).val();
        Config.twitter.tweet_live_started = !!$( '#twitter-tweet_live_started' ).prop( 'checked' );
        Config.twitter.tweet_play_started = !!$( '#twitter-tweet_play_started' ).prop( 'checked' );

    },

    /**
     * Config.foo.bar に value をセットする
     * @param key
     * @param value
     */
    saveConfig: function( key, value ){
        keys = k.split( '.' );
        tmp = Config;
        for( let key; key = keys.shift(); ){
            if( keys.length <= 0 ){
                tmp[key] = value;
            }else{
                tmp = tmp[key];
            }
        }
    },


    saveAndQuit: function(){
        if( Config.loaded ){
            this.storeSettings();

            browser.storage.sync.set( {'config': Config} ).then(
                ( result ) =>{
                    console.log( 'config saved.' );
                    window.close();
                },
                ( error ) =>{
                    console.log( 'config save error.' );
                } );
        }
    },

    init: function(){
        console.log( 'initialize settings.' );

        this.initVideoInfoUI();
        this.initRequestUI();
        this.initResponseUI();
        this.initTwitterUI();
        this.initTalkerUI();


        $( '#show-details' ).prop( 'checked', Config.show_description );
        $( '#comment-184' ).prop( 'checked', Config.comment.comment184 );
        $( '#comment-autokotehan' ).prop( 'checked', Config.comment.autokotehan );
        $( '#comment-display-num' ).val( Config.comment.display_lines );
        $( '#comment-backlog-num' ).val( Config.comment.history_lines_on_connect );
        $( '#comment-autocomplete' ).val( Config.comment.autocomplete );

        $( '#ng-video-list' ).val( Config.request.ng_video );


        $( '#prepare-length' ).spinner( {min: 40, max: 600} );
        $( '#play-interval' ).spinner( {min: 0, max: 99} );

        $( '#videoinfo-interval' ).spinner( {min: 0, max: 99} );
        $( '#comment-display-num' ).spinner( {min: 0, max: 10000} );
        $( '#comment-backlog-num' ).spinner( {min: 0, max: 500} );

        $( '#submit' ).on( 'click', ( ev ) =>{
            this.saveAndQuit();
        } );

        $( '#cancel' ).on( 'click', ( ev ) =>{
            window.close();
        } );

        Resize();
    }
};

function Resize(){
    let h1 = $( window ).height();
    let h2 = $( '#footer' ).outerHeight();
    console.log( `height: ${h1} ${h2}` );
    $( '#container' ).height( parseInt( h1 - h2 ) + 'px' );
}


window.addEventListener( 'load', ( ev ) =>{
    Options.defaultValue = JSON.parse( JSON.stringify( Config ) );

    browser.storage.sync.get( 'config' ).then(
        ( result ) =>{
            console.log( 'config loaded' );
            console.log( result );

            Config = MergeSimpleObject( Config, result.config );
            // Config = result.config;
            Config.loaded = true;

            Options.init();
        },
        ( error ) =>{
            console.log( error );
            Config.loaded = true;
            Options.init();
        } );

} );

window.addEventListener( 'resize', ( ev ) =>{
    Resize();
} );
