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

var Twitter = {
    consumer: "s7oBmLr1QbvyMkwNojgMVw",
    consumerSecret: "jGgsV5nKfchguFWcfmVtil1Dz77vCykiTznhzdwcV0",

    requestTokenURL: "https://api.twitter.com/oauth/request_token",
    authenticateURL: "https://api.twitter.com/oauth/authenticate", // ?oauth_token=hoge
    accessTokenURL: "https://api.twitter.com/oauth/access_token",
    authorizeURL: "https://api.twitter.com/oauth/authorize",

    updateURL: "https://api.twitter.com/1.1/statuses/update.json",
    updateMediaURL: "https://api.twitter.com/1.1/statuses/update_with_media.json",

    uploadMediaURL: "https://upload.twitter.com/1.1/media/upload.json",

    oauth: {},

    getScreenName: function(){
        // TODO 使うなら要修正
        return Config.twitter.screen_name;
    },

    getSavedToken: function(){
        // ログインマネージャに保存したトークンとシークレットトークンを読み込む.
        this.oauth = {};
        this.oauth["oauth_token"] = Config['oauth-token'];
        this.oauth["oauth_token_secret"] = Config['oauth-secret-token'];
    },

    openAuthPage: function( url ){
        // OpenLink( url );
        // window.open( url, '_blank' );
        $( '#twitter-get-pin-link' ).attr( 'href', url );
        $( '#twitter-get-pin-link' ).text( 'PIN取得ページを開く' );
    },

    getRequestToken: function(){
        this._getRequestToken( this.consumer, this.consumerSecret );
    },

    _getRequestToken: function( consumer, consumerSecret ){
        // Desktop clientで7-digit PINコードを使うときに
        // まずはrequest token URLにアクセスしoauth_tokenを取得して、
        // authorize URLにoauth_tokenをGETパラメタで渡すと、
        // 7-digit PINコードを取得できる.
        let accessor = {
            consumerSecret: consumerSecret,
            tokenSecret: ""
        };
        let message = {
            action: this.requestTokenURL,
            method: "POST",
            parameters: []
        };
        message.parameters.push( ["oauth_consumer_key", consumer] );
        message.parameters.push( ["oauth_signature_method", "HMAC-SHA1"] );
        message.parameters.push( ["oauth_timestamp", ""] );
        message.parameters.push( ["oauth_nonce", ""] );
        message.parameters.push( ["oauth_signature", ""] );
        message.parameters.push( ["oauth_callback", "oob"] );
        OAuth.setTimestampAndNonce( message );
        OAuth.SignatureMethod.sign( message, accessor );

        let req = new XMLHttpRequest();
        if( !req ) return;

        req.onreadystatechange = function(){
            if( req.readyState != 4 ) return;
            if( req.status == 200 ){
                let values = req.responseText.split( '&' );
                for( let i = 0, item; item = values[i]; i++ ){
                    let val = item.split( '=' );
                    Twitter.oauth[val[0]] = val[1];
                }
                let url = Twitter.authenticateURL + "?oauth_token=" + Twitter.oauth['oauth_token'];
                Twitter.openAuthPage( url );
            }else{
                setTimeout( function(){
                    Twitter.getRequestToken();
                }, 1000 );
            }
            console.log( 'request token:' + req.responseText );
        };
        let url = this.requestTokenURL;
        req.open( 'POST', url );
        req.setRequestHeader( 'Authorization',
            OAuth.getAuthorizationHeader( 'http://miku39.jp/', message.parameters ) );
        req.send( '' );
    },

    // Twitterトークンをログインマネージャに保存.
    saveTwitterToken: function( oauthobj ){
        // 現在未使用
        Config.twitter.token = oauthobj["oauth_token"];
        Config.twitter.secret_token = oauthobj["oauth_token_secret"];
        Config.twitter.screen_name = oauthobj["screen_name"];
    },

    getAccessToken: async function( pin ){
        let p = new Promise( ( resolve, reject ) =>{
            let consumer = this.consumer;
            let consumerSecret = this.consumerSecret;
            console.log( `PIN:${pin}` );

            // 7-digit PINを使ったアクセストークンの取得.
            let accessor = {
                consumerSecret: consumerSecret,
                tokenSecret: ""
            };
            let message = {
                action: this.accessTokenURL,
                method: "POST",
                parameters: []
            };
            message.parameters.push( ["oauth_consumer_key", consumer] );
            message.parameters.push( ["oauth_nonce", ""] );
            message.parameters.push( ["oauth_signature", ""] );
            message.parameters.push( ["oauth_signature_method", "HMAC-SHA1"] );
            message.parameters.push( ["oauth_timestamp", ""] );
            message.parameters.push( ["oauth_token", this.oauth.oauth_token] );
            message.parameters.push( ["oauth_verifier", pin] );
            message.parameters.push( ["oauth_version", "1.0"] );

            OAuth.setTimestampAndNonce( message );
            OAuth.SignatureMethod.sign( message, accessor );

            let req = new XMLHttpRequest();
            if( !req ){
                reject( null );
                return;
            }

            req.onreadystatechange = function(){
                if( req.readyState != 4 ) return;
                if( req.status == 200 ){
                    let values = req.responseText.split( '&' );
                    Twitter.oauth = {};
                    for( let i = 0, item; item = values[i]; i++ ){
                        let val = item.split( '=' );
                        Twitter.oauth[val[0]] = val[1];
                    }
                    // Twitter.saveTwitterToken( Twitter.oauth );
                    // $( '#twitter-screen-name' ).text( "@" + Twitter.oauth['screen_name'] );
                    resolve( Twitter.oauth );
                }else{
                    console.log( "Twitter認証に失敗しました。\n再度、認証を行ってみてください。" );
                    alert( "Twitter認証に失敗しました。\n再度、認証を行ってみてください。" );
                }
                console.log( 'status=' + req.status );
                console.log( req.responseText );
            };
            let url = this.accessTokenURL;
            req.open( 'POST', url );
            req.setRequestHeader( 'Content-type', 'application/x-www-form-urlencoded' );

            let xauth = [];
            let str = [];
            xauth = message.parameters;
            for( let i = 0, item; item = xauth[i]; i++ ){
                str.push( item[0] + "=" + item[1] + "" );
            }
            req.send( str.join( '&' ) );
        } );
        return p;
    },

    /**
     * ステータスを更新する(つぶやく)
     * @param text テキスト(文字数チェックしていない)
     */
    updateStatus: function( text, retryflg ){
        if( !this.oauth["oauth_token_secret"] || !this.oauth["oauth_token"] ) return;
        let accessor = {
            consumerSecret: this.consumerSecret,
            tokenSecret: this.oauth["oauth_token_secret"]
        };
        let message = {
            action: this.updateURL,
            method: "POST",
            parameters: []
        };
        message.parameters.push( ["oauth_consumer_key", this.consumer] );
        message.parameters.push( ["oauth_nonce", ""] );
        message.parameters.push( ["oauth_token", this.oauth["oauth_token"]] );
        message.parameters.push( ["oauth_signature", ""] );
        message.parameters.push( ["oauth_signature_method", "HMAC-SHA1"] );
        message.parameters.push( ["oauth_timestamp", ""] );
        message.parameters.push( ["oauth_version", "1.0"] );
        message.parameters.push( ["status", text] );

        OAuth.setTimestampAndNonce( message );
        OAuth.SignatureMethod.sign( message, accessor );

        let req = new XMLHttpRequest();
        if( !req ) return;

        req.onreadystatechange = function(){
            if( req.readyState != 4 ) return;
            /*
             403 {"request":"/1/statuses/update.json","error":"Status is a duplicate."}
             401 {"request":"/1/statuses/update.json","error":"Could not authenticate you."}
             */
            if( req.status != 200 ){
                console.log( "Status=" + req.status );
                if( !retryflg && req.status == 401 ){
                    setTimeout( () =>{
                        Twitter.updateStatus( text, true );
                    }, 500 );
                    return;
                }
                let result = JSON.parse( req.responseText );
                NicoLiveHelper.showAlert( 'Twitter:' + result.errors[0].message );
            }
            //console.log('update result:'+req.responseText);
        };
        let url = this.updateURL;
        req.open( 'POST', url );
        req.setRequestHeader( 'Authorization',
            OAuth.getAuthorizationHeader( 'http://miku39.jp/', message.parameters ) );
        req.setRequestHeader( 'Content-type', 'application/x-www-form-urlencoded' );
        req.send( "status=" + encodeURIComponent( text ) );
    },

    /**
     * ステータスを更新する(つぶやく)
     * @param text テキスト(文字数チェックしていない)
     * @param picture 画像データ(BASE64)
     */
    updateStatusWithMedia: function( text, picture ){
        if( !this.oauth["oauth_token_secret"] || !this.oauth["oauth_token"] ) return;
        let accessor = {
            consumerSecret: this.consumerSecret,
            tokenSecret: this.oauth["oauth_token_secret"]
        };
        let message = {
            action: this.uploadMediaURL,
            method: "POST",
            parameters: []
        };
        message.parameters.push( ["oauth_consumer_key", this.consumer] );
        message.parameters.push( ["oauth_nonce", ""] );
        message.parameters.push( ["oauth_token", this.oauth["oauth_token"]] );
        message.parameters.push( ["oauth_signature", ""] );
        message.parameters.push( ["oauth_signature_method", "HMAC-SHA1"] );
        message.parameters.push( ["oauth_timestamp", ""] );
        message.parameters.push( ["oauth_version", "1.0"] );
        //message.parameters.push(["status",text]);
        //message.parameters.push(["media[]",picture]);

        OAuth.setTimestampAndNonce( message );
        OAuth.SignatureMethod.sign( message, accessor );

        let req = new XMLHttpRequest();
        if( !req ) return;

        req.onreadystatechange = function(){
            if( req.readyState != 4 ) return;
            /*
             403 {"request":"/1/statuses/update.json","error":"Status is a duplicate."}
             401 {"request":"/1/statuses/update.json","error":"Could not authenticate you."}
             */
            if( req.status != 200 ){
                console.log( "Status=" + req.status );
                AlertPrompt( "画像のアップロードに失敗しました。", "艦これタイマー" );
                ShowNotice( "送信に失敗しました" );
            }else{
                // 画像アップロードに成功したら、続いてつぶやく
                let result;
                try{
                    result = JSON.parse( req.responseText );
                    console.log( result );
                    Twitter.tweetWithMediaId( text, result );
                }catch( e ){
                    ShowNotice( "JSONパースエラー" );
                }
            }
        };

        /* 画像をアップロード */
        let url = this.uploadMediaURL;
        let form = new FormData();
        form.append( "media_data", picture );
        req.open( 'POST', url );
        req.setRequestHeader( 'Authorization',
            OAuth.getAuthorizationHeader( 'http://miku39.jp/', message.parameters ) );
        req.send( form );
    },

    tweetWithMediaId: function( text, media ){
        console.log( "Media ID:" + media.media_id );
        if( !this.oauth["oauth_token_secret"] || !this.oauth["oauth_token"] ) return;
        let accessor = {
            consumerSecret: this.consumerSecret,
            tokenSecret: this.oauth["oauth_token_secret"]
        };
        let message = {
            action: this.updateURL,
            method: "POST",
            parameters: []
        };
        message.parameters.push( ["oauth_consumer_key", this.consumer] );
        message.parameters.push( ["oauth_nonce", ""] );
        message.parameters.push( ["oauth_token", this.oauth["oauth_token"]] );
        message.parameters.push( ["oauth_signature", ""] );
        message.parameters.push( ["oauth_signature_method", "HMAC-SHA1"] );
        message.parameters.push( ["oauth_timestamp", ""] );
        message.parameters.push( ["oauth_version", "1.0"] );

        OAuth.setTimestampAndNonce( message );
        OAuth.SignatureMethod.sign( message, accessor );

        let req = new XMLHttpRequest();
        if( !req ) return;

        req.onreadystatechange = function(){
            if( req.readyState != 4 ) return;
            if( req.status != 200 ){
                console.log( "Status=" + req.status );
                let result;
                try{
                    result = JSON.parse( req.responseText );
                    console.log( 'Twitter:' + result.error );
                }catch( e ){
                }
                let str = "つぶやきに失敗しました。";
                ShowNotice( str );
            }else{
                // 成功
                window.close();
            }
        };

        /* 画像をアップロード */
        let url = this.updateURL;
        let form = new FormData();
        form.append( "status", text );
        form.append( "media_ids", media.media_id_string );
        req.open( 'POST', url );
        req.setRequestHeader( 'Authorization',
            OAuth.getAuthorizationHeader( 'http://miku39.jp/', message.parameters ) );
        req.send( form );
    },

    init: function(){
        this.getSavedToken();
    }
};

