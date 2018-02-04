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

var NicoLiveHelper = {
    liveProp: {},       ///< 生放送情報(ニコ生から取得する)

    connecttime: 0,     ///< 生放送への接続時刻
    nico_user_id: '',   ///< ニコニコ動画のユーザーID
    is_premium: 0,      ///< プレミアム会員かどうか

    ticket: '',
    threadId: '',
    postkey: '',

    /**
     * 放送に接続しているかを返す.
     * @return {boolean}
     */
    isConnected: function(){
        return !!this.connecttime;
    },

    isCaster: function(){
        try{
            // 公式放送だと isOperator が存在していない
            // TODO 生主判定はどっち？
            // return !!this.liveProp.user.isOperator;
            return this.liveProp.user.isBroadcaster;
        }catch( e ){
            return true;
        }
    },

    /**
     * 新配信で運営コメント送信をする.
     *
     * isPermコメントを消すには clearApiUrl に DELETE リクエストを送る
     *
     * @param text コメント
     * @param mail コマンド欄
     * @param name 名前
     * @param isPerm ずっと表示させる. true or false. 旧/permの役割
     */
    postCasterComment: function( text, mail, name, isPerm ){
        if( text == '' ) return;
        if( !this.isCaster() ) return;
        mail = mail || '';
        name = name || '';
        isPerm = !!isPerm;

        let url = this.liveProp.program.broadcasterComment.postApiUrl;

        // TODO 現状主コメは80文字までなのでマクロ展開する余地があるかどうか
        // text = this.replaceMacros( text, info );

        let xhr = CreateXHR( 'PUT', url );
        xhr.onreadystatechange = () =>{
            if( xhr.readyState != 4 ) return;
            if( xhr.status != 200 ){
                console.log( `${xhr.status} ${xhr.responseText}` );
                let error = JSON.parse( xhr.responseText );
                console.log( `コメント送信: ${error.meta.errorMessage || error.meta.errorCode}` );
                // this.showAlert( `コメント送信: ${error.meta.errorMessage || error.meta.errorCode}` );
                return;
            }
            console.log( `Comment posted: ${xhr.responseText}` );
        };

        xhr.setRequestHeader( 'x-public-api-token', this.liveProp.site.relive.csrfToken );

        let form = new FormData();
        form.append( 'text', text );
        form.append( 'command', mail );
        form.append( 'name', name );
        form.append( 'isPermanent', isPerm );
        xhr.send( form );
    },


    /**
     * @param threadId
     * @private
     */
    getpostkey: function( threadId ){
        let getpostkey = {
            "type": "watch",
            "body": {"params": [threadId], "command": "getpostkey"}
        };
        this._comm.send( JSON.stringify( getpostkey ) );
    },

    /**
     * 視聴者コメントをする.
     * @param mail
     * @param text
     */
    sendComment: function( mail, text ){
        if( !text ) return;

        this._getpostkeyfunc = () =>{
            this.sendComment( mail, text );
        };

        if( Config.comment.comment184 ){
            mail += " 184";
        }

        let vpos = Math.floor( (GetCurrentTime() - this.liveProp.program.openTime / 1000) * 100 );
        let chat = {
            "chat": {
                "thread": this.threadId,
                "vpos": vpos,
                "mail": mail,
                "ticket": this.ticket,
                "user_id": this.nico_user_id,
                "premium": this.is_premium,
                "postkey": this.postkey,
                "content": text
            }
        };
        this._comment_svr.send( JSON.stringify( chat ) );
        console.log( chat );
    },

    /**
     * 受信したコメントを処理する.
     * @param chat{Comment}
     */
    processComment: function( chat ){
        NicoLiveComment.addComment( chat );

        switch( chat.premium ){
        case 2: // チャンネル生放送の場合、こちらの場合もあり。/infoコマンドなどもココ
        case 3: // 運営コメント
            break;

        case 1: // プレミアム会員
        case 0: // 一般会員
            // リスナーコメント
            // TODO 接続時より前のコメントは反応しないようにする

            // TODO コメント読み上げ
            if( false && Config.speech.do_speech ){
                if( chat.date > this.connecttime ){
                    // NicoLiveTalker.webspeech2( chat.text_notag, Config.speech.speech_character_index );
                }
            }
            break;

        default:
            break;
        }
    },

    /**
     * コメントサーバーからコメントデータを受け取ったときの処理.
     * @param data
     */
    onCommentReceived: function( data ){
        // console.log( data );    // TODO コメント受信したときのログ表示
        if( data.thread ){
            // data.thread.ticket;
            // data.thread.last_res;
            // data.thread.resultcode;
            this.ticket = data.thread.ticket;
            console.log( `ticket:${this.ticket}` );
        }

        if( data.chat_result ){
            let result = data.chat_result;
            switch( result.status ){
            case 4:
                // コメントするには postkey の再取得が必要
                this.getpostkey( this.threadId );
                break;

            case 1:
                // 送信テキストが空のときに発生する
                console.log( `コメントの送信エラーです` );
                break;
            case 8:
                console.log( `コメントが長すぎます` );
                break;

            default:
                break;
            }
        }

        if( data.chat ){
            let chat = data.chat;
            // 念のために従来のように値がなかった時のため
            chat.mail = chat.mail || "";
            chat.name = chat.name || "";
            chat.locale = chat.locale || "";
            chat.score = chat.score || 0;   // スコアは負の数
            chat.date = chat.date || 0;     // UNIX時間
            chat.premium = chat.premium || 0;
            chat.user_id = chat.user_id || "0";
            chat.anonymity = chat.anonymity || 0;
            chat.no = chat.no || 0;
            chat.comment_no = chat.no;
            chat.text = chat.content;

            chat.yourpost = chat.yourpost || 0; // 自分のコメントかどうかの1 or 0
            if( chat.user_id == this.nico_user_id ){
                // yourpostは過去ログには適用されないので自身で判断
                // ただし184だと識別できないのでユーザーIDが一致するときだけ。
                chat.yourpost = 1;
            }

            if( chat.premium == 3 || chat.premium == 2 ){
                // 主コメ
                chat.text_notag = chat.text.replace( /<.*?>/g, "" );
            }else{
                chat.text_notag = chat.text;
            }

            this.processComment( chat );
        }
    },

    /**
     * WebSocketでコメントサーバーに接続する.
     * @param room
     */
    connectCommentServer: function( room ){
        console.log( 'connect comment server(websocket)...' );
        console.log( `websocket uri: ${room.messageServerUri}` );
        console.log( `thread id: ${room.threadId}` );
        console.log( `room name: ${room.roomName}` );
        console.log( `server type: ${room.messageServerType}` );

        this.threadId = room.threadId;

        // sub-protocol "msg.nicovideo.jp#json"
        this._comment_svr = new Comm( room.messageServerUri, "msg.nicovideo.jp#json" );
        this._comment_svr.connect();
        this._comment_svr.onConnect( ( ev ) =>{
            console.log( 'comment server connected.' );
            this.connecttime = GetCurrentTime();

            // TODO 過去ログ取得行数指定
            let lines = Config.comment.history_lines_on_connect * -1;
            // let lines = -50;
            let str = {
                "thread": {
                    "thread": "" + room.threadId,
                    "version": "20061206",
                    "fork": 0,
                    "user_id": this.nico_user_id,
                    "res_from": lines,
                    "with_global": 1,
                    "scores": 1,
                    "nicoru": 0,
                    "userkey": ""
                }
            };
            this._comment_svr.send( JSON.stringify( str ) );
            console.log( `コメントサーバーに接続しました` );

            // TODO 再生履歴に番組名と開始時刻を記録
            // let hist;
            // hist = this.liveProp.program.title + " " + this.liveProp.program.nicoliveProgramId + " (" + GetDateString( this.liveProp.program.beginTime, true ) + "-)\n";
            // NicoLiveHistory.addHistoryText( hist );
        } );
        this._comment_svr.onReceive( ( ev ) =>{
            let data = JSON.parse( ev.data );
            this.onCommentReceived( data );
        } );
    },

    onWatchCommandReceived: function( data ){
        // console.log( data ); // TODO 受信時のログ表示
        let body = data.body;
        switch( data.type ){
        case 'watch':
            switch( body.command ){
            case 'userstatus':
                // HTML5ならthis.liveProp.userStatusにも格納されている
                this.nico_user_id = body.params[0];
                // プレミアム会員フラグ
                this.is_premium = body.params[1].match( /true/i ) ? 1 : 0;
                // 公式放送だと isCommentable フラグで受け取るコメント内容が違う
                // 実際、HTML5版とFlash版プレイヤーで内容が違う
                let getpermit = {
                    "type": "watch",
                    "body": {
                        "command": "getpermit",
                        "requirement": {
                            "broadcastId": this.liveProp.program.broadcastId,
                            "route": "",
                            // "stream": {"protocol": "hls", "requireNewStream": true, "priorStreamQuality": "high"},
                            "room": {"isCommentable": true, "protocol": "webSocket"}
                        }
                    }
                };
                this._comm.send( JSON.stringify( getpermit ) );
                break;
            case 'servertime':
                // サーバー時刻
                // let svrtime = new Date( parseInt( body.params[0] ) );
                // DebugLog( `svr time: ${svrtime}` );
                break;
            case 'permit':
                // 不明
                break;
            case 'currentstream':
                // ライブ動画配信のアドレス
                break;
            case 'currentroom':
                // コメントサーバー
                this.connectCommentServer( body.room );
                this.getpostkey( body.room.threadId );
                break;
            case 'statistics':
                // body.params[0]; // 来場者数
                // body.params[1]; // コメント数
                // body.params[2]; // 不明
                // body.params[3]; // 不明
                // リスナー数更新
                console.log( `Now ${body.params[0]} listeners. ${body.params[1]} comments.` );
                $( '#number-of-listeners' ).text( FormatCommas( body.params[0] ) );
                break;
            case 'watchinginterval':
                // body.params[0]; // 何かの間隔秒数
                break;
            case 'schedule':
                // 放送時間の更新か？
                // body.update.begintime;
                // body.update.endtime;
                console.log( `begin time:${body.update.begintime}, end time:${body.update.endtime}` );
                $( '#live-progress' ).attr( 'title', `終了日時: ${GetDateTimeString( body.update.endtime, 1 )}` );
                break;
            case 'postkey':
                this.postkey = body.params[0];
                // body.params[0]; // postkey
                // body.params[1]; // null
                // body.params[2]; // 何かの数字postkeyに含まれるものと同じ
                console.log( `postkey:${this.postkey}` );

                if( "function" === typeof this._getpostkeyfunc ){
                    this._getpostkeyfunc();
                    this._getpostkeyfunc = null;
                }
                break;
            }

            break;
        case 'ping':
            this._comm.send( JSON.stringify( {"type": "pong", "body": {}} ) );
            break;
        }
    },

    /**
     *　ニコ生に接続開始する.
     */
    connectServer: function(){
        console.log( 'connect websocket' );
        let ws = this.liveProp.site.relive.webSocketUrl;

        this._comm = new Comm( ws );
        this._comm.connect();
        this._comm.onConnect( ( ev ) =>{
            console.log( `websocket connected. ${this.liveProp.program.nicoliveProgramId}` );
            setTimeout( () =>{
                let getuserstatus = {"type": "watch", "body": {"params": [], "command": "getuserstatus"}};
                this._comm.send( JSON.stringify( getuserstatus ) );
            }, 100 );
        } );
        this._comm.onReceive( ( ev ) =>{
            let data = JSON.parse( ev.data );
            this.onWatchCommandReceived( data );
        } );
    },


    /**
     * 動画情報のXMLをJavascriptオブジェクトにする.
     *
     * @param xml
     * @returns {Object}
     * @throw String エラーコードを例外として投げる
     */
    extractVideoInfo: function( xml ){
        // ニコニコ動画のgetthumbinfoのXMLから情報抽出.
        let info = new VideoInformation();

        let error = GetXmlText( xml, "/nicovideo_thumb_response/error/code" );
        if( error ){
            // COMMUNITY or NOT_FOUND or DELETED
            throw error;
        }

        let root;
        root = xml.getElementsByTagName( 'thumb' )[0];
        if( !root ) throw "no thumb tag";

        let tags = ["jp", "tw", "us"];
        let tagscnt = 0;
        for( let i = 0, elem; elem = root.childNodes[i]; i++ ){
            switch( elem.tagName ){
            case "user_id":
                info.user_id = elem.textContent;
                break;
            case "user_nickname":
                // 投稿者名
                info.user_nickname = elem.textContent;
                break;
            case "video_id":
                info.video_id = elem.textContent;
                break;
            case "title":
                info.title = restorehtmlspecialchars( elem.textContent );
                break;
            case "description":
                info.description = restorehtmlspecialchars( elem.textContent ).replace( /　/g, ' ' );
                info.description = info.description.replace( /<.*?>/g, "" );
                break;
            case "thumbnail_url":
                info.thumbnail_url = elem.textContent;
                break;
            case "first_retrieve":
                // Firefox 4からISO 8601フォーマットを読めるのでそのまま利用
                let d = new Date( elem.textContent );
                info.first_retrieve = d.getTime() / 1000; // seconds from epoc.
                break;
            case "length":
                // TODO getthumbinfoの情報と実際の再生時間が違う動画がある
                if( 0 && this._videolength["_" + info.video_id] ){
                    // getthumbinfo のデータと実際が合わない動画があるので調整データベースから
                    info.length = this._videolength["_" + info.video_id];
                }else{
                    info.length = elem.textContent;
                }
                let len = info.length.match( /\d+/g );
                info.length_ms = (parseInt( len[0], 10 ) * 60 + parseInt( len[1], 10 )) * 1000;
                break;
            case "view_counter":
                info.view_counter = parseInt( elem.textContent );
                break;
            case "comment_num":
                info.comment_num = parseInt( elem.textContent );
                break;
            case "mylist_counter":
                info.mylist_counter = parseInt( elem.textContent );
                break;
            case "tags":
                // attribute domain=jp のチェックが必要.
                // また、半角に正規化.
                let domain = elem.getAttribute( 'domain' ) || 'jp';
                let tag = elem.getElementsByTagName( 'tag' );
                if( !info.tags ){
                    info.tags = {};
                    info.tags_locked = {};
                }
                if( !info.tags[domain] ){
                    info.tags[domain] = [];
                    info.tags_locked[domain] = [];
                }
                else{
                    domain = 'tag' + tagscnt;
                    info.tags[domain] = [];
                    info.tags_locked[domain] = [];
                }
                if( !info.tags_array ) info.tags_array = [];
                for( let i = 0, item; item = tag[i]; i++ ){
                    let tag = restorehtmlspecialchars( ZenToHan( item.textContent ) );
                    info.tags[domain].push( tag );
                    info.tags_array.push( tag );

                    let tmp = item.getAttribute( 'lock' );
                    info.tags_locked[domain].push( !!tmp );
                }
                tagscnt++;
                break;
            case "size_high":
                info.filesize = parseInt( elem.textContent );
                info.highbitrate = elem.textContent;
                info.highbitrate = (info.highbitrate * 8 / (info.length_ms / 1000) / 1000).toFixed( 2 ); // kbps "string"
                break;
            case "size_low":
                info.lowbitrate = elem.textContent;
                info.lowbitrate = (info.lowbitrate * 8 / (info.length_ms / 1000) / 1000).toFixed( 2 ); // kbps "string"
                break;
            case "movie_type":
                info.movie_type = elem.textContent;
                break;
            case "no_live_play":
                info.no_live_play = parseInt( elem.textContent );
                break;
            default:
                break;
            }
        }
        // video_id がないときはエラーとしておこう、念のため.
        if( !info.video_id ){
            throw "no video id.";
        }

        // TODO P名取得
        // try{
        //     info.pname = this.getPName( info );
        // }catch( x ){
        //     info.pname = "";
        // }

        try{
            info.mylistcomment = NicoLiveMylist.mylist_itemdata["_" + info.video_id].description;
        }catch( x ){
            info.mylistcomment = "";
        }

        // TODO 機械学習による分類機能
        // if( Config.do_classify  ){
        //     let str = new Array();
        //     // 半角小文字で正規化してトレーニングをしているので、分類するときもそのように.
        //     for( k in info.tags ){
        //         for( let i = 0, tag; tag = info.tags[k][i]; i++ ){
        //             str.push( ZenToHan( tag.toLowerCase() ) );
        //         }
        //     }
        //     info.classify = NicoLiveClassifier.classify( str );
        // }

        return info;
    },

    /**
     * 動画情報を取得する.
     * @param video_id
     * @returns {Promise}
     */
    getVideoInfo: function( video_id ){
        let p1 = new Promise( ( resolve, reject ) =>{
            NicoApi.getthumbinfo( video_id, ( xml, req ) =>{
                try{
                    let vinfo = NicoLiveHelper.extractVideoInfo( xml );
                    vinfo.video_id = video_id;
                    resolve( vinfo );
                }
                catch( e ){
                    if( e === 'DELETED' ){
                    }
                    console.log( 'extract failed:' + e + ' ' + video_id );
                    reject( e );
                }
            } );
        } );
        return p1;
    },

    /**
     * 動画情報の表示用のエレメントを作成して返す.
     * @param vinfo
     * @returns {Node}
     */
    createVideoInfoElement: function( vinfo ){
        let t = document.querySelector( '#template-video-info' );
        let clone2 = document.importNode( t.content, true );
        let elem = clone2.firstElementChild;
        elem.setAttribute( 'nico_video_id', vinfo.video_id );

        let thumbnail_image = elem.querySelector( '.nico-thumbnail' );
        let bitrate = elem.querySelector( '.nico-bitrate' );
        let title = elem.querySelector( '.nico-title' );
        let video_prop = elem.querySelector( '.nico-video-prop' );
        let description = elem.querySelector( '.nico-description' );
        let tags = elem.querySelector( '.nico-tags' );
        let link = elem.querySelector( '.nico-link' );

        if( vinfo.no_live_play ){
            $( title ).addClass( 'no_live_play' );
        }
        if( vinfo.is_self_request ){
            $( elem ).addClass( 'self_request' );
            $( title ).addClass( 'self_request' );
        }

        link.setAttribute( "href", "http://www.nicovideo.jp/watch/" + vinfo.video_id );

        thumbnail_image.src = vinfo.thumbnail_url;
        thumbnail_image.addEventListener( 'mouseover', ( ev ) =>{
            NicoLiveHelper.showThumbnail( ev, vinfo.video_id );
        } );
        thumbnail_image.addEventListener( 'mouseout', ( ev ) =>{
            NicoLiveHelper.hideThumbnail();
        } );

        bitrate.textContent = vinfo.highbitrate.substring( 0, vinfo.highbitrate.length - 3 ) + 'k/' + vinfo.movie_type;
        title.textContent = vinfo.video_id + ' ' + vinfo.title;
        let tmp = GetDateString( vinfo.first_retrieve * 1000, true );
        video_prop.textContent = '投:' + tmp + ' 再:' + FormatCommas( vinfo.view_counter )
            + ' コ:' + FormatCommas( vinfo.comment_num ) + ' マ:' + FormatCommas( vinfo.mylist_counter ) + ' 時間:' + vinfo.length;

        //--- description
        // description.textContent = vinfo.description;
        {
            let div2 = document.createElement( 'div' );
            let str;
            str = vinfo.description.split( /(mylist\/\d+|sm\d+|nm\d+)/ );
            for( let i = 0; i < str.length; i++ ){
                let s = str[i];
                if( s.match( /mylist\/\d+/ ) ){
                    let a = document.createElement( 'a' );
                    let mylist = s;
                    a.setAttribute( "href", "http://www.nicovideo.jp/" + mylist );
                    a.setAttribute( "target", "_blank" );
                    a.setAttribute( "style", "text-decoration: underline;" );
                    a.appendChild( document.createTextNode( s ) );
                    div2.appendChild( a );
                }else if( s.match( /(sm|nm)\d+/ ) ){
                    let a = document.createElement( 'a' );
                    let vid = s;
                    a.setAttribute( "href", "http://www.nicovideo.jp/watch/" + vid );
                    a.setAttribute( "target", "_blank" );
                    a.setAttribute( "style", "text-decoration: underline;" );

                    a.addEventListener( 'mouseover', ( ev ) =>{
                        NicoLiveHelper.showThumbnail( ev, vid );
                    } );
                    a.addEventListener( 'mouseout', ( ev ) =>{
                        NicoLiveHelper.hideThumbnail();
                    } );
                    a.appendChild( document.createTextNode( s ) );
                    div2.appendChild( a );
                }else{
                    div2.appendChild( document.createTextNode( s ) );
                }
            }
            description.appendChild( div2 );
        }

        vinfo.tags['jp'].forEach( ( elem, idx, arr ) =>{
            let tag = document.createElement( 'span' );
            tag.setAttribute( 'class', 'badge badge-secondary' );
            tag.textContent = elem + ' ';

            if( vinfo.tags_locked['jp'][idx] ){
                let lockicon = document.createElement( 'span' );
                lockicon.setAttribute( 'class', 'glyphicon glyphicon-lock' );
                lockicon.setAttribute( 'aria-hidden', 'true' );
                tag.append( lockicon );
            }

            tags.appendChild( tag );
            tags.appendChild( document.createTextNode( ' ' ) );
        } );
        return elem;
    },

    /**
     * リストに含まれている動画の合計時間を返す.
     * @param list
     * @returns {{min: (Number|*), sec: (number|*)}}
     */
    calcTotalVideoTime: function( list ){
        let t = 0;
        let s;

        for( let i = 0, item; item = list[i]; i++ ){
            s = item.length_ms;
            t += s;
        }
        t /= 1000;
        let min, sec;
        min = parseInt( t / 60 );
        sec = t % 60;
        if( sec < 10 ){
            sec = '0' + sec;
        }
        return {"min": min, "sec": sec};
    },

    /**
     * 動画サムネイルを表示する.
     * @param event DOMイベント
     * @param video_id 動画ID
     */
    showThumbnail: function( event, video_id ){
        document.querySelector( '#iframe-thumbnail' ).src = "http://ext.nicovideo.jp/thumb/" + video_id;
        let x, y;
        // 312x176
        x = event.clientX;
        y = event.clientY;
        if( y + 176 > window.innerHeight ){
            y = y - 176 - 10;
        }
        if( x + 312 > window.innerWidth ){
            x = x - 312 - 10;
        }
        document.querySelector( '#iframe-thumbnail' ).style.left = x + 5 + "px";
        document.querySelector( '#iframe-thumbnail' ).style.top = y + 5 + "px";
        document.querySelector( '#iframe-thumbnail' ).style.display = 'block';
        document.querySelector( '#iframe-thumbnail' ).width = 312;
        document.querySelector( '#iframe-thumbnail' ).height = 176;
        document.querySelector( '#iframe-thumbnail' ).style.opacity = 1;
    },

    /**
     * 動画サムネイルを非表示にする.
     */
    hideThumbnail: function(){
        document.querySelector( '#iframe-thumbnail' ).width = 312;
        document.querySelector( '#iframe-thumbnail' ).height = 0;
        document.querySelector( '#iframe-thumbnail' ).style.opacity = 0;
    },


    /**
     * 毎秒更新処理.
     */
    update: function(){
        let now = GetCurrentTime();
        let liveprogress = now - this.liveProp.program.beginTime;

        $( '#live-progress' ).text( liveprogress < 0 ? `-${GetTimeString( -liveprogress )}` : GetTimeString( liveprogress ) );
    },

    test: async function(){
    },

    initUI: async function(){
        $( '#mylist-manager' ).on( 'click', ( ev ) =>{
            window.open( 'mylistmanager/mylistmanager.html', 'nicolivehelperx_mylistmanager',
                'width=640,height=480,menubar=no,toolbar=no,location=no' );
        } );

        $( '#close-window' ).on( 'click', ( ev ) =>{
            window.close();
        } );
    },

    init: async function(){
        let extension_info = await browser.management.getSelf();
        console.log( `NicoLive Helper X-2 ${extension_info.version}` );
        this.version = extension_info.version;
        console.log( 'initialize nicolivehelper.' );

        let result = await browser.storage.local.get( 'config' );
        console.log( 'Config loaded:' );
        console.log( result );

        this.initUI();
        NicoLiveRequest.init();
        NicoLiveComment.init();

        let lvid = GetParameterByName( 'lv' );
        console.log( 'lvid=' + lvid );

        if( lvid ){
            console.log( 'get liveinfo' );
            this.liveProp = await browser.runtime.sendMessage( {
                cmd: 'get-liveinfo',
                request_id: lvid
            } );
            console.log( this.liveProp );
            if( this.liveProp ){
                this.connectServer();
            }

            if( this.liveProp.program.providerType === 'official' ){
                $( '#community-id' ).text( 'OFFICIAL' );
            }else{
                $( '#community-id' ).text( this.liveProp.community.id );
                $( '#live-caster' ).text( this.liveProp.program.supplier.name );
            }
            $( '#live-title' ).text( this.liveProp.program.title );
        }

        setInterval( ( ev ) =>{
            this.update();
        }, 1000 );

        this.test();
    }
};


window.addEventListener( 'load', ( ev ) =>{
    NicoLiveHelper.init();
} );
