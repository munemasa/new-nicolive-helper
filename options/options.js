/*
 Copyright (c) 2017-2018 amano <amano@miku39.jp>

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


function LoadValue( key, config, defvalue ){
    if( config[key] != undefined ){
        document.querySelector( `#${key}` ).value = config[key];
    }else{
        document.querySelector( `#${key}` ).value = defvalue;
    }
}

function LoadBool( key, config, defvalue ){
    document.querySelector( `#${key}` ).checked = config[key] || defvalue;
}

function SaveValue( key, config ){
    config[key] = document.querySelector( `#${key}` ).value;
}

function SaveInt( key, config ){
    config[key] = parseInt( document.querySelector( `#${key}` ).value );
}

function SaveBool( key, config, value ){
    config[key] = document.querySelector( `#${key}` ).checked;
}


let g_vinfokey = [
    "vinfo-command-1",
    "vinfo-comment-1",
    "vinfo-command-2",
    "vinfo-comment-2",
    "vinfo-command-3",
    "vinfo-comment-3",
    "vinfo-command-4",
    "vinfo-comment-4"
];

let g_vinfo_defvalue = [
    '',
    '♪時間:{length} 再生数:{view} コメント:{comment} マイリスト:{mylist}',
    '',
    '♪{id} {title} 投稿日:{date}',
    '',
    '',
    '',
    ''
];


function InitTwitterUI(){
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
}


async function LoadOptions(){
    let result = await browser.storage.local.get( 'config' );
    console.log( result );

    let config = result.config || {};

    /* 進行 */
    LoadValue( 'autoplay-interval', config, 10 );

    /* リクエスト */
    LoadBool( 'request-no-duplicated', config, Config['request-no-duplicated'] );
    LoadBool( 'request-no-played', config, Config['request-no-played'] );

    LoadBool( 'request-send-reply', config, Config['request-send-reply'] );
    LoadValue( 'request-accept', config, Config['request-accept'] );
    LoadValue( 'request-not-allow', config, Config['request-not-allow'] );
    LoadValue( 'request-no-live-play', config, Config['request-no-live-play'] );
    LoadValue( 'request-deleted', config, Config['request-deleted'] );
    LoadValue( 'request-duplicated', config, Config['request-duplicated'] );
    LoadValue( 'request-played', config, Config['request-played'] );

    /* コメント */
    LoadBool( 'comment-184', config, false );
    LoadBool( 'auto-kotehan', config, false );
    LoadValue( 'comment-dispay-lines', config, 500 );
    LoadValue( 'comment-backlog-num', config, 50 );

    /* 動画情報 */
    LoadValue( 'videoinfo-interval', config, 7 );
    let i = 0;
    for( let k of g_vinfokey ){
        LoadValue( k, config, g_vinfo_defvalue[i] );
        i++;
    }

    /* Twitter */
    LoadBool( 'tweet-on-play', config, Config['tweet-on-play'] );
    LoadValue( 'tweet-text', config, Config['tweet-text'] );
    LoadValue( 'oauth-token', config, '' );
    LoadValue( 'oauth-secret-token', config, '' );

    $( '#twitter-screen-name' ).text( config['twitter-screen-name'] );
    /* Twitter認証 */
    $( '#btn-twitter-get-pin' ).on( 'click', ( ev ) =>{
        Twitter.getRequestToken();
    } );
    $( '#btn-twitter-auth' ).on( 'click', async ( ev ) =>{
        let pin = $( '#txt-twitter-pin' ).val();
        let result = await Twitter.getAccessToken( pin );
        $( '#twitter-screen-name' ).text( `@${result['screen_name']}` );
        $( '#oauth-token' ).val( result['oauth_token'] );
        $( '#oauth-secret-token' ).val( result['oauth_token_secret'] );
    } );
}

function SaveOptions( ev ){
    ev.preventDefault();
    console.log( 'save settings' );

    let config = {};

    /* 進行 */
    SaveInt( 'autoplay-interval', config );

    /* リクエスト */
    SaveBool( 'request-no-duplicated', config );
    SaveBool( 'request-no-played', config );

    SaveBool( 'request-send-reply', config );
    SaveValue( 'request-accept', config );
    SaveValue( 'request-not-allow', config );
    SaveValue( 'request-no-live-play', config );
    SaveValue( 'request-deleted', config );
    SaveValue( 'request-duplicated', config );
    SaveValue( 'request-played', config );

    /* コメント */
    SaveBool( 'comment-184', config );
    SaveBool( 'auto-kotehan', config );
    SaveInt( 'comment-dispay-lines', config );
    SaveInt( 'comment-backlog-num', config );

    /* 動画情報 */
    SaveInt( 'videoinfo-interval', config );
    for( let k of g_vinfokey ){
        SaveValue( k, config );
    }

    /* Twitter */
    SaveBool( 'tweet-on-play', config );
    SaveValue( 'tweet-text', config );
    SaveValue( 'oauth-token', config );
    SaveValue( 'oauth-secret-token', config );
    config['twitter-screen-name'] = $( '#twitter-screen-name' ).text();

    browser.storage.local.set( {
        'config': config
    } );
}

window.addEventListener( 'load', function( ev ){
    LoadOptions();

    document.querySelector( "#btn-save-config" ).addEventListener( "click", function( ev ){
        SaveOptions( ev );
    } );
} );
