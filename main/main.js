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

    live_begintime: 0,  ///< 放送開始時刻(UNIX時間ms)
    live_endtime: 0,    ///< 放送終了時刻(UNIX時間ms)
    currentVideo: null, ///< 現在再生中の動画

    // コメント送信に必要な要素
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

    getLiveId: function(){
        try{
            return this.liveProp.program.nicoliveProgramId;
        }catch( e ){
            return null;
        }
    },

    /**
     * 動画再生時の音量設定を返す.
     * @returns {number}
     */
    getVolume: function(){
        return $( '#volume-slider' ).slider( 'value' ) / 10;
    },

    /**
     * 経過時間表示のバー長を設定する.
     * @param p パーセンテージ数
     */
    setProgressMain: function( p ){
        $( '#progressbar-main' ).width( p + "%" );
    },


    /**
     * ボリューム変更をする.
     * スライダーを動かすたびにリクエストするとエラーになるので
     * 2秒の猶予を持って実行する。
     */
    changeVolume: function(){
        if( this.currentVideo ){
            clearTimeout( this._change_volume_timer );
            this._change_volume_timer = setTimeout( () =>{
                this.playVideo( this.currentVideo, true );
            }, 2000 );
        }
    },

    /**
     * 動画情報をコメント
     * @param vinfo{VideoInformation}
     * @returns {Promise<void>}
     */
    sendVideoInfo: async function( vinfo ){
        let vinfo_command = [
            "vinfo-command-1",
            "vinfo-command-2",
            "vinfo-command-3",
            "vinfo-command-4"
        ];
        let vinfo_comment = [
            "vinfo-comment-1",
            "vinfo-comment-2",
            "vinfo-comment-3",
            "vinfo-comment-4"
        ];

        for( let i = 0; i < vinfo_comment.length; i++ ){
            let cmd = Config[vinfo_command[i]] || '';
            let txt = Config[vinfo_comment[i]] || '';
            if( !txt ) break;
            this.postCasterComment( txt, cmd, '', false );
            await Wait( Config['videoinfo-interval'] * 1000 );
        }
    },

    /**
     * 動画再生を停止する.
     * @returns {Promise<any>}
     */
    stopVideo: function(){
        let p = new Promise( ( resolve, reject ) =>{
            if( !this.isConnected() ){
                reject( null );
                return;
            }

            let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/broadcast/mixing`;
            let xhr = CreateXHR( 'PUT', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    console.log( `${xhr.status} ${xhr.responseText}` );

                    // 400 {"meta":{"status":400,"errorCode":"BAD_REQUEST","errorMessage":"引用再生できない動画です"}}
                    let err = JSON.parse( xhr.responseText );
                    this.showAlert( `${err.meta.errorMessage}` );
                    //this.currentVideo = null;
                    reject( err );
                    return;
                }
                this.currentVideo = null;
                this.setProgressMain( 0 );
                resolve( true );
            };

            xhr.setRequestHeader( 'Content-type', 'application/json;charset=utf-8' );
            xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

            let volume = this.getVolume();
            let data = {
                'mixing': [
                    {
                        'audio': 0,
                        'content': this.liveProp.program.nicoliveProgramId,
                        'display': 'main'
                    }
                ]
            };
            xhr.send( JSON.stringify( data ) );
        } );
        return p;
    },

    /**
     * 動画を再生する
     * @param vinfo{VideoInformation} 再生したい動画情報
     * @param is_change_volume ボリューム変更のみ
     * @returns {Promise<any>}
     */
    playVideo: function( vinfo, is_change_volume ){
        // 次動画の再生したあとに音量変更が走ると困るのでタイマーを取り消す
        clearTimeout( this._change_volume_timer );
        let p = new Promise( ( resolve, reject ) =>{
            if( !this.isConnected() ){
                reject( null );
                return;
            }
            if( GetCurrentTime() >= this.live_endtime / 1000 ){
                this.showAlert( `放送終了時刻を過ぎたため再生できません` );
                reject( null );
                return null;
            }

            let video_id = vinfo.video_id;
            let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/broadcast/mixing`;

            let xhr = CreateXHR( 'PUT', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    console.log( `${xhr.status} ${xhr.responseText}` );

                    // 400 {"meta":{"status":400,"errorCode":"BAD_REQUEST","errorMessage":"引用再生できない動画です"}}
                    let err = JSON.parse( xhr.responseText );
                    this.showAlert( `${vinfo.video_id}: ${err.meta.errorMessage}` );
                    //this.currentVideo = null;
                    reject( err );
                    return;
                }
                this.currentVideo = CopyObject( vinfo );
                if( !is_change_volume ){
                    // 再生成功したら、再生履歴に記録する
                    NicoLiveHistory.addHistory( vinfo );
                    this.sendVideoInfo( vinfo );

                    let now = GetCurrentTime();
                    this.currentVideo.play_begin = now;
                    this.currentVideo.play_end = now + parseInt( this.currentVideo.length_ms / 1000 );
                }
                resolve( true );
            };

            xhr.setRequestHeader( 'Content-type', 'application/json;charset=utf-8' );
            xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

            let volume = this.getVolume();
            let data = {
                'mixing': [
                    {
                        'audio': 0,
                        'content': this.liveProp.program.nicoliveProgramId,
                        'display': 'none'
                    },
                    {
                        'audio': volume,
                        'content': video_id,
                        'display': 'main'
                    }
                ]
            };
            xhr.send( JSON.stringify( data ) );
        } );
        return p;
    },

    /**
     * 現在再生している動画IDを返す.
     * mixingを叩くので生主専用。
     * @returns {Promise<any>}
     */
    getCurrentVideo: function(){
        let p = new Promise( ( resolve, reject ) =>{
            if( !this.isConnected() ){
                resolve( '' );
                return;
            }

            let url = `http://live2.nicovideo.jp/unama/api/v3/programs/${this.getLiveId()}/broadcast/mixing`;

            let xhr = CreateXHR( 'GET', url );
            xhr.onreadystatechange = () =>{
                if( xhr.readyState != 4 ) return;
                if( xhr.status != 200 ){
                    console.log( `${xhr.status} ${xhr.responseText}` );
                    let err = JSON.parse( xhr.responseText );
                    reject( err );
                    return;
                }

                let cur = JSON.parse( xhr.responseText );
                for( let video of cur.data.mixing ){
                    if( video.content.match( /((sm|nm)\d+)/ ) ){
                        resolve( video.content );
                    }
                }
                resolve( '' );
            };

            xhr.setRequestHeader( 'Content-type', 'application/json;charset=utf-8' );
            xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

            xhr.send();
        } );
        return p;
    },

    /**
     * 文字列のマクロ展開を行う.
     * @param str 置換元も文字列
     * @param info 動画情報
     */
    replaceMacros: function( str, info ){
        let replacefunc = function( s, p ){
            let tmp = s;
            let expression;
            if( expression = p.match( /^=(.*)/ ) ){
                try{
                    tmp = eval( expression[1] );
                    if( tmp == undefined || tmp == null ) tmp = "";
                }catch( x ){
                    tmp = "";
                }
                return tmp;
            }
            switch( p ){
            case 'id':
                if( !info.video_id ) break;
                tmp = info.video_id;
                break;
            case 'title':
                if( !info.title ) break;
                tmp = info.title;
                break;
            case 'date':
                if( !info.first_retrieve ) break;
                tmp = GetDateString( info.first_retrieve * 1000, true );
                break;
            case 'length':
                if( !info.length ) break;
                tmp = info.length;
                break;
            case 'view':
                if( !info.view_counter && 'number' != typeof info.view_counter ) break;
                tmp = FormatCommas( info.view_counter );
                break;
            case 'comment':
                if( !info.comment_num && 'number' != typeof info.comment_num ) break;
                tmp = FormatCommas( info.comment_num );
                break;
            case 'mylist':
                if( !info.mylist_counter && 'number' != typeof info.mylist_counter ) break;
                tmp = FormatCommas( info.mylist_counter );
                break;
            case 'mylistrate':
                if( !info.mylist_counter && 'number' != typeof info.mylist_counter ) break;
                if( !info.view_counter && 'number' != typeof info.view_counter ) break;
                if( info.view_counter == 0 ){
                    tmp = "0.0%";
                }else{
                    tmp = (100 * info.mylist_counter / info.view_counter).toFixed( 1 ) + "%";
                }
                break;
            case 'tags':
                // 1行40文字程度までかなぁ
                if( !info.tags['jp'] ) break;
                tmp = info.tags['jp'].join( '　' );
                // TODO 新配信ではタグが使えないので改行しない
                // tmp = tmp.replace( /(.{35,}?)　/g, "$1<br>" );
                break;
            case 'username':
                // 動画の投稿者名
                tmp = info.user_nickname || "";
                break;
            case 'pname':
                // TODO P名
                break;
            case 'additional':
                // TODO 動画DBに登録してある追加情報
                break;
            case 'description':
                // 詳細を40文字まで(世界の新着と同じ)
                tmp = info.description.match( /.{1,40}/ );
                break;

            case 'comment_no':
                // リク主のコメント番号
                tmp = info.comment_no || 0;
                break;

            case 'requestnum': // リク残数.
                tmp = NicoLiveRequest.request.length;
                break;
            case 'requesttime': // TODO リク残時間(mm:ss).
                let reqtime = NicoLiveRequest.getRequestTime();
                tmp = GetTimeString( reqtime.min * 60 + reqtime.sec );
                break;
            case 'stocknum':  // TODO ストック残数.
                let remainstock = 0;
                NicoLiveStock.stock.forEach( function( item ){
                    if( !item.is_played ) remainstock++;
                } );
                tmp = remainstock;
                break;
            case 'stocktime': // TODO ストック残時間(mm:ss).
                let stocktime = NicoLiveStock.getStockTime();
                tmp = GetTimeString( stocktime.min * 60 + stocktime.sec );
                break;

            case 'mylistcomment':
                // マイリストコメント
                tmp = info.mylistcomment;
                if( !tmp ) tmp = "";
                break;

            case 'pref:min-ago':
                // 枠終了 n 分前通知の設定値.
                tmp = Config.notice.time;
                break;

            case 'end-time':
                // 放送の終了時刻.
                tmp = GetDateString( NicoLiveHelper.live_endtime, true );
                break;

            case 'live-id':
                tmp = NicoLiveHelper.getLiveId();
                break;
            case 'live-title':
                tmp = NicoLiveHelper.liveProp.program.title;
                break;
            }
            return tmp;
        };
        // String.replace()だとネストが処理できないので自前で置換
        let r = "";
        let token = "";
        let nest = 0;
        for( let i = 0, ch; ch = str.charAt( i ); i++ ){
            switch( nest ){
            case 0:
                if( ch == '{' ){
                    nest++;
                    token += ch;
                    break;
                }
                r += ch;
                break;
            default:
                token += ch;
                if( ch == '{' ) nest++;
                if( ch == '}' ){
                    nest--;
                    if( nest <= 0 ){
                        try{
                            r += replacefunc( token, token.substring( 1, token.length - 1 ) );
                        }catch( x ){
                        }
                        token = "";
                    }
                }
                break;
            }
        }
        return r;
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
        text = this.replaceMacros( text, this.currentVideo );

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

        xhr.setRequestHeader( 'X-Public-Api-Token', this.liveProp.site.relive.csrfToken );

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

        if( Config['comment-184'] ){
            mail += " 184";
        }

        let vpos = Math.floor( (GetCurrentTime() - this.liveProp.program.beginTime) * 100 );
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
     * 視聴者コメントを処理する.
     */
    processListenersComment: function( chat ){
        let text = chat.text_notag;

        if( text.match( /((sm|nm)\d+)/ ) ){
            let video_id = RegExp.$1;
            let is_self_request = !!text.match( /[^他](貼|張)|自|関/ );
            let code = "";
            // TODO 作品コードの処理
            // code = chat.text.match( /(...[-+=/]....[-+=/].)/ )[1];
            // code = code.replace( /[-+=/]/g, "-" ); // JWID用作品コード.
            // NicoLiveHelper.product_code["_" + video_id] = code;
            NicoLiveRequest.addRequest( video_id, chat.comment_no, chat.user_id, is_self_request, code );
        }
        if( text.match( /(\d{10})/ ) ){
            let video_id = RegExp.$1;
            if( video_id == "8888888888" ) return;
            let is_self_request = !!text.match( /[^他](貼|張)|自|関/ );
            let code = "";
            NicoLiveRequest.addRequest( video_id, chat.comment_no, chat.user_id, is_self_request, code );
        }
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
            if( chat.text.match( /^\/disconnect/ ) ){
                this.showAlert( `放送が終了しました` );
                this.live_endtime = 0;
            }
            break;

        case 1: // プレミアム会員
        case 0: // 一般会員
            // リスナーコメント
            // TODO 接続時より前のコメントは反応しないようにする
            if( this.isCaster() && chat.date < this.connecttime ) return;
            this.processListenersComment( chat );

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

            // 過去ログ取得行数指定
            let lines = Config['comment-backlog-num'] * -1;
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
            this.showAlert( `コメントサーバーに接続しました` );

            // 再生履歴に番組名と開始時刻を記録
            let hist;
            hist = `${this.liveProp.program.nicoliveProgramId} ${this.liveProp.program.title} (${GetDateString( this.liveProp.program.beginTime * 1000, true )}-)\n`;
            NicoLiveHistory.addHistoryText( hist );
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
                console.log( 'currentstream' );
                console.log( data );
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
                this.live_begintime = body.update.begintime;
                this.live_endtime = body.update.endtime;
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
     * 配列をソートする.
     * @param queue ソートする配列
     * @param type ソート方法
     * @param order 昇順(1) or 降順(-1)
     */
    sortVideoList: function( queue, type, order ){
        // order:1だと昇順、order:-1だと降順.
        queue.sort( function( a, b ){
            let tmpa, tmpb;
            switch( type ){
            case 0:// 再生数.
                tmpa = a.view_counter;
                tmpb = b.view_counter;
                break;
            case 1:// コメ.
                tmpa = a.comment_num;
                tmpb = b.comment_num;
                break;
            case 2:// マイリス.
                tmpa = a.mylist_counter;
                tmpb = b.mylist_counter;
                break;
            case 3:// 時間.
                tmpa = a.length_ms;
                tmpb = b.length_ms;
                break;
            case 4:// 投稿日.
            default:
                tmpa = a.first_retrieve;
                tmpb = b.first_retrieve;
                break;
            case 5:// マイリス率.
                tmpa = a.mylist_counter / a.view_counter;
                tmpb = b.mylist_counter / b.view_counter;
                break;
            case 6:// タイトル.
                if( a.title < b.title ){
                    return -order;
                }else{
                    return order;
                }
                break;
            case 7:// マイリス登録日.
                tmpa = a.registerDate;
                tmpb = b.registerDate;
                break;
            case 8:// 宣伝ポイント.
                tmpa = a.uadp;
                tmpb = b.uadp;
                break;
            case 9:// ビットレート
                tmpa = a.highbitrate;
                tmpb = b.highbitrate;
                break;
            }
            return (tmpa - tmpb) * order;
        } );
    },

    /**
     * 動画情報の表示用のエレメントを作成して返す.
     * @param vinfo{VideoInformation}
     * @returns {Node}
     */
    createVideoInfoElement: function( vinfo ){
        let t = document.querySelector( '#template-video-info' );
        let clone2 = document.importNode( t.content, true );
        let elem = clone2.firstElementChild;
        elem.setAttribute( 'nico_video_id', vinfo.video_id );
        if( vinfo.is_played ){
            $( elem ).addClass( 'video_played' );
        }

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
     * ウィンドウ下部にアラートメッセージを表示する.
     * @param text
     */
    showAlert: function( text ){
        $( '#my-alert-message' ).text( text );
        $( '#my-alert' ).show( 100 );

        clearTimeout( this._alert_timer );
        this._alert_timer = setTimeout( function(){
            $( '#my-alert' ).hide( 100 );
        }, 4000 );
    },


    updateVideoProgress: function( now ){
        // 動画の経過時間
        try{
            let current = this.currentVideo;
            let remain = current.play_end - now;
            if( remain < 0 ) remain = 0;
            $( '#remaining-time-main' ).text( `${current.title}(-${GetTimeString( remain )})` );

            let len = parseInt( current.length_ms / 1000 );
            let t = now - current.play_begin;

            let percent = parseInt( (t / len) * 100 );
            if( percent > 100 ) percent = 100;
            this.setProgressMain( percent );
        }catch( e ){
            $( '#remaining-time-main' ).text( `---(-0:00)` );
        }
    },

    /**
     * 毎秒更新処理.
     */
    update: function(){
        let now = GetCurrentTime();

        this.updateVideoProgress( now );

        // 生放送の経過時間
        let liveprogress = now - this.liveProp.program.beginTime;
        $( '#live-progress' ).text( liveprogress < 0 ? `-${GetTimeString( -liveprogress )}` : GetTimeString( liveprogress ) );
    },

    test: async function(){
    },

    initUI: async function(){
        $( '#btn-stop-play' ).on( 'click', ( ev ) =>{
            this.stopVideo();
        } );
        $( '#mylist-manager' ).on( 'click', ( ev ) =>{
            window.open( 'mylistmanager/mylistmanager.html', 'nicolivehelperx_mylistmanager',
                'width=640,height=480,menubar=no,toolbar=no,location=no' );
        } );

        $( '#open-video-db' ).on( 'click', ( ev ) =>{
            window.open( 'db/videodb.html', 'nicolivehelperx_videodb',
                'width=640,height=480,menubar=no,toolbar=no,location=no' );
        } );

        $( '#save-comment' ).on( 'click', ( ev ) =>{
            NicoLiveComment.saveFile();
        } );

        $( '#open-settings' ).on( 'click', ( ev ) =>{
            browser.runtime.openOptionsPage();
        } );

        $( '#close-window' ).on( 'click', ( ev ) =>{
            window.close();
        } );

        /* 音量スライダー */
        let handle = $( "#custom-handle" );
        $( "#volume-slider" ).slider( {
            value: 5,  // TODO デフォルト値を記録・復元する
            max: 10,
            min: 0,
            create: function(){
                handle.text( $( this ).slider( "value" ) * 10 );
            },
            slide: function( event, ui ){
                handle.text( ui.value * 10 );
                NicoLiveHelper.changeVolume();
            }
        } );
    },

    init: async function(){
        let extension_info = await browser.management.getSelf();
        console.log( `New NicoLive Helper ${extension_info.version}` );
        this.version = extension_info.version;
        console.log( 'initialize nicolivehelper.' );

        /* 設定のロード */
        let result = await browser.storage.local.get( 'config' );
        console.log( 'Config loaded:' );
        MergeSimpleObject( Config, result.config );
        console.log( Config );

        browser.storage.onChanged.addListener( ( changes, area ) =>{
            if( changes.config ){
                MergeSimpleObject( Config, changes.config.newValue );
                console.log( Config );
            }
        } );

        this.initUI();

        NicoLiveMylist.init();
        NicoLiveRequest.init();
        NicoLiveStock.init();
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
            try{
                this.update();
            }catch( e ){
            }
        }, 1000 );

        this.test();
    }
};


window.addEventListener( 'load', ( ev ) =>{
    NicoLiveHelper.init();
} );
