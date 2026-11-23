/* 全站中日英三语切换 + 深浅色主题（语言/主题都会记在本地） */

(function () {
    const KEY_LANG = 'site_lang';
    const KEY_THEME = 'site_theme';
    const LANGS = ['zh', 'ja', 'en'];
    const CJK = /[\u4e00-\u9fa5]/;

    let lang = 'zh';
    let applying = false;
    let observer = null;
    let timer = 0;

    /* ---------------- 词表：中文原文 → 译文（中文直接保留原文） ---------------- */
    const WORDS = {
        /* 导航与品牌 */
        '日向论坛': { en: 'Hinata Forum', ja: '日向フォーラム' },
        '逛逛': { en: 'Browse', ja: '見て回る' },
        '首页大厅': { en: 'Home', ja: 'ホーム' },
        '历史论坛': { en: 'Forum', ja: '掲示板' },
        '更新日志': { en: 'Changelog', ja: '更新履歴' },
        '工具': { en: 'Tools', ja: 'ツール' },
        'AI 助手': { en: 'AI Assistant', ja: 'AI アシスタント' },
        '格式转换': { en: 'Convert', ja: 'フォーマット変換' },
        '文档转换': { en: 'Documents', ja: 'ドキュメント変換' },
        '解压工具': { en: 'Archives', ja: '解凍ツール' },
        '翻译': { en: 'Translate', ja: '翻訳' },
        'SVC 转换': { en: 'SVC', ja: 'SVC 変換' },
        '账号': { en: 'Account', ja: 'アカウント' },
        '用户中心': { en: 'Profile', ja: 'ユーザーセンター' },
        '切换侧栏': { en: 'Toggle sidebar', ja: 'サイドバー切替' },
        '切换深浅色': { en: 'Toggle dark mode', ja: 'ダークモード切替' },
        '选择界面语言': { en: 'Choose language', ja: '言語を選択' },
        '拖动调整大小': { en: 'Drag to resize', ja: 'ドラッグでサイズ変更' },

        /* 首页 */
        '游客可以看帖。发帖和用户中心需要登录。': {
            en: 'Guests can read posts. Log in to publish posts or use your profile.',
            ja: 'ゲストは投稿を閲覧できます。投稿とユーザーセンターにはログインが必要です。'
        },
        '写一条帖子': { en: 'Write a post', ja: '投稿を書く' },
        '记录当下，也看看别人的近况': { en: 'Share the moment and see what others are up to', ja: '今を記録して、みんなの近況も見てみよう' },
        '问问 AI': { en: 'Ask AI', ja: 'AI に聞く' },
        '有问题直接问，记录会保存在服务器': { en: 'Ask anything; your history is saved on the server', ja: '気軽に質問。履歴はサーバーに保存されます' },
        '语音转换工具入口': { en: 'Voice conversion tool', ja: '音声変換ツールの入口' },
        '看看更新': { en: 'See updates', ja: '更新を見る' },
        '每个版本改了什么': { en: 'What changed in each version', ja: '各バージョンの変更点' },
        '最近的帖子': { en: 'Recent posts', ja: '最近の投稿' },
        '还没有帖子。': { en: 'No posts yet.', ja: 'まだ投稿がありません。' },
        '还没有帖子，去论坛写第一条吧。': { en: 'No posts yet. Be the first to post in the forum.', ja: 'まだ投稿がありません。最初の投稿を書いてみましょう。' },
        '帖子加载失败': { en: 'Failed to load posts', ja: '投稿の読み込みに失敗しました' },
        '夜深了': { en: 'It is late', ja: '夜も深まりました' },
        '早上好': { en: 'Good morning', ja: 'おはようございます' },
        '中午好': { en: 'Good afternoon', ja: 'こんにちは' },
        '下午好': { en: 'Good afternoon', ja: 'こんにちは' },
        '晚上好': { en: 'Good evening', ja: 'こんばんは' },
        '旅人': { en: 'traveler', ja: '旅人' },

        /* 论坛 */
        '想说点什么...': { en: 'Say something...', ja: '何か書いてみましょう...' },
        '发布': { en: 'Publish', ja: '投稿する' },
        '请先登录才能发帖': { en: 'Please log in to publish a post', ja: '投稿するにはログインしてください' },
        '内容不能为空': { en: 'Content cannot be empty', ja: '内容を入力してください' },
        '发布失败': { en: 'Failed to publish', ja: '投稿に失敗しました' },
        '发布失败，请检查网络': { en: 'Failed to publish. Check your network.', ja: '投稿に失敗しました。通信を確認してください' },

        /* AI 聊天 */
        '登录后可保存聊天记录': { en: 'Log in to save chat history', ja: 'ログインするとチャット履歴を保存できます' },
        '清空记录': { en: 'Clear history', ja: '履歴を消去' },
        '输入问题，回车发送': { en: 'Type a question and press Enter', ja: '質問を入力して Enter で送信' },
        '发送': { en: 'Send', ja: '送信' },
        '有什么想聊的，直接说就好。': { en: 'Feel free to ask anything.', ja: '何でも気軽に話しかけてください。' },
        '登录后聊天记录会保存在服务器，下次登录可以接着聊。': {
            en: 'Chat history is saved to the server after login, so you can continue next time.',
            ja: 'ログインすると履歴がサーバーに保存され、次回も続きから話せます。'
        },
        '去登录': { en: 'Log in', ja: 'ログイン' },
        '正在想...': { en: 'Thinking...', ja: '考え中...' },
        '登录后才能使用 AI，并把聊天记录保存到服务器': {
            en: 'Log in to use the AI and save chat history on the server',
            ja: 'AI の利用と履歴の保存にはログインが必要です'
        },
        '确定清空全部聊天记录吗？当日额度不会恢复。': {
            en: 'Clear all chat history? Today\u2019s quota will not be restored.',
            ja: 'すべての履歴を消去しますか？本日の利用枠は戻りません。'
        },
        '清空失败': { en: 'Failed to clear history', ja: '履歴の消去に失敗しました' },
        '清空失败，请检查网络': { en: 'Failed to clear history. Check your network.', ja: '履歴の消去に失敗しました。通信を確認してください' },
        '请求失败': { en: 'Request failed', ja: 'リクエストに失敗しました' },
        '网络请求失败，请稍后再试': { en: 'Network error. Please try again later.', ja: '通信に失敗しました。しばらくしてから再試行してください' },

        /* 格式转换 */
        '全部在浏览器本地完成，文件不会上传服务器': {
            en: 'Everything runs locally in your browser; files are never uploaded',
            ja: 'すべてブラウザ内で処理され、ファイルはサーバーに送信されません'
        },
        '提取 / 转音频': { en: 'Extract audio', ja: '音声を抽出' },
        '转换视频': { en: 'Convert video', ja: '動画を変換' },
        '视频截图': { en: 'Video frame', ja: '動画フレーム' },
        '点击选择文件，或把音视频拖到这里': { en: 'Click to choose a file, or drop audio/video here', ja: 'ファイルを選択、または音声・動画をここにドロップ' },
        '常见 MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A 都可以': {
            en: 'MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A are supported',
            ja: 'MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A に対応'
        },
        '输出格式': { en: 'Output format', ja: '出力形式' },
        '质量': { en: 'Quality', ja: '品質' },
        '高质量（文件更大）': { en: 'High quality (larger file)', ja: '高画質（ファイル大）' },
        '标准': { en: 'Standard', ja: '標準' },
        '小体积': { en: 'Small size', ja: '小サイズ' },
        '高质量': { en: 'High quality', ja: '高画質' },
        '转换在浏览器本地完成，文件不会上传；首次使用需要加载约 32MB 的转换引擎。': {
            en: 'Conversion runs locally in your browser and files are never uploaded. First use loads a ~32MB engine.',
            ja: '変換はブラウザ内で行われ、ファイルは送信されません。初回は約 32MB のエンジンを読み込みます。'
        },
        '开始转换': { en: 'Start conversion', ja: '変換を開始' },
        '图片格式': { en: 'Image format', ja: '画像形式' },
        'PNG（无损）': { en: 'PNG (lossless)', ja: 'PNG（可逆）' },
        'JPG': { en: 'JPG', ja: 'JPG' },
        '截取当前帧': { en: 'Capture current frame', ja: '現在のフレームを保存' },
        '拖动进度条选好画面后点「截取当前帧」，导出的是视频原始分辨率的图片。': {
            en: 'Drag the slider to pick a frame, then click "Capture current frame". The image is exported at the video\u2019s original resolution.',
            ja: 'スライダーで画面を選び「現在のフレームを保存」を押すと、元の解像度で書き出します。'
        },
        '点击选择视频，或把视频拖到这里': { en: 'Click to choose a video, or drop it here', ja: '動画を選択、またはここにドロップ' },
        '支持 MP4 / MOV / WEBM / MKV 等浏览器能播放的格式': { en: 'Supports browser-playable formats such as MP4 / MOV / WEBM / MKV', ja: 'ブラウザで再生できる MP4 / MOV / WEBM / MKV などに対応' },
        '选择视频后，在时间轴上选一帧截图。': { en: 'Choose a video, then pick a frame on the timeline.', ja: '動画を選び、タイムラインでフレームを選択してください。' },
        '拖动进度条选择画面后点「截取当前帧」。': { en: 'Drag the slider, then click "Capture current frame".', ja: 'スライダーで画面を選び「現在のフレームを保存」を押してください。' },
        '正在读取视频信息…': { en: 'Reading video info...', ja: '動画情報を読み込み中...' },
        '这个视频浏览器无法解码，换一个 MP4 / WEBM 文件试试。': { en: 'Your browser cannot decode this video. Try an MP4 / WEBM file.', ja: 'この動画はブラウザで再生できません。MP4 / WEBM をお試しください。' },
        '视频还没准备好，请稍等一下。': { en: 'The video is not ready yet. Please wait a moment.', ja: '動画の準備ができていません。少しお待ちください。' },
        '截图失败，换一个视频再试试。': { en: 'Capture failed. Try another video.', ja: 'キャプチャに失敗しました。別の動画でお試しください。' },
        '截图完成，点击右侧「下载」保存。': { en: 'Frame captured. Click "Download" on the right to save.', ja: '保存しました。右側の「ダウンロード」から保存してください。' },
        '下载': { en: 'Download', ja: 'ダウンロード' },
        '换一个': { en: 'Choose another', ja: '別のファイル' },
        '转换中…': { en: 'Converting...', ja: '変換中...' },
        '正在加载转换引擎，约 32MB，请保持页面打开…': { en: 'Loading conversion engine (~32MB). Keep this page open...', ja: '変換エンジン（約 32MB）を読み込み中。ページを閉じないでください...' },
        '引擎已就绪，可以开始转换了。': { en: 'Engine ready. You can start converting.', ja: 'エンジンの準備ができました。変換を開始できます。' },
        '引擎已就绪，选择文件后即可开始转换。': { en: 'Engine ready. Choose a file to start converting.', ja: 'エンジンの準備ができました。ファイルを選んで変換を開始できます。' },
        '转换引擎加载失败，请检查网络后重试。': { en: 'Failed to load the conversion engine. Check your network and retry.', ja: '変換エンジンの読み込みに失敗しました。通信を確認して再試行してください。' },
        '正在读取文件…': { en: 'Reading file...', ja: 'ファイルを読み込み中...' },
        '正在转换，视频较大时需要等一会儿，请不要关闭页面…': { en: 'Converting. Large videos take a while; please do not close the page...', ja: '変換中です。大きな動画は時間がかかるため、ページを閉じないでください...' },
        '正在生成下载文件…': { en: 'Preparing download...', ja: 'ダウンロードファイルを生成中...' },
        '转换完成，点击下方按钮保存文件。': { en: 'Done. Click the button below to save the file.', ja: '変換完了。下のボタンからファイルを保存してください。' },
        '转换失败：': { en: 'Conversion failed: ', ja: '変換に失敗しました：' },
        '未知错误': { en: 'unknown error', ja: '不明なエラー' },
        '文件超过 800MB，浏览器内存可能不够，建议先裁剪或压缩后再试。': {
            en: 'The file exceeds 800MB; the browser may run out of memory. Trim or compress it first.',
            ja: 'ファイルが 800MB を超えています。ブラウザのメモリが不足する可能性があるため、事前に分割・圧縮してください。'
        },
        'MP4（H.264）': { en: 'MP4 (H.264)', ja: 'MP4（H.264）' },
        'MOV（H.264）': { en: 'MOV (H.264)', ja: 'MOV（H.264）' },
        'WEBM（VP8）': { en: 'WEBM (VP8)', ja: 'WEBM（VP8）' },
        'MKV（直接封装）': { en: 'MKV (remux)', ja: 'MKV（そのまま格納）' },
        'AVI（MPEG-4）': { en: 'AVI (MPEG-4)', ja: 'AVI（MPEG-4）' },
        'GIF（无声动图）': { en: 'GIF (silent animation)', ja: 'GIF（無音アニメ）' },
        'OGG（Vorbis）': { en: 'OGG (Vorbis)', ja: 'OGG（Vorbis）' },
        'M4A（AAC）': { en: 'M4A (AAC)', ja: 'M4A（AAC）' },

        /* 文档转换 */
        '文档与图片转换': { en: 'Documents & images', ja: 'ドキュメントと画像の変換' },
        '图片 → PDF': { en: 'Images → PDF', ja: '画像 → PDF' },
        'PDF → 图片': { en: 'PDF → Images', ja: 'PDF → 画像' },
        '文档 → PDF': { en: 'Documents → PDF', ja: '文書 → PDF' },
        'PDF → 文本': { en: 'PDF → Text', ja: 'PDF → テキスト' },
        '点击选择图片，或拖到这里': { en: 'Click to choose images, or drop them here', ja: '画像を選択、またはここにドロップ' },
        '支持 PNG / JPG / JPEG / WEBP / GIF / BMP': { en: 'Supports PNG / JPG / JPEG / WEBP / GIF / BMP', ja: 'PNG / JPG / JPEG / WEBP / GIF / BMP に対応' },
        '选择一张或多张图片，合成 PDF': { en: 'Choose one or more images to combine into a PDF', ja: '1 枚以上の画像を選んで PDF にまとめる' },
        '多张图片会按选择顺序各占一页': { en: 'Each image becomes one page, in the order selected', ja: '複数の画像は選択順に 1 ページずつ配置されます' },
        '点击选择 PDF 文件，或拖到这里': { en: 'Click to choose a PDF, or drop it here', ja: 'PDF を選択、またはここにドロップ' },
        '每一页会导出成一张图片': { en: 'Each page is exported as an image', ja: '各ページを画像として書き出します' },
        '选择文档，转成 PDF': { en: 'Choose a document to convert to PDF', ja: '文書を選んで PDF に変換' },
        '支持 TXT / Markdown / HTML / DOCX': { en: 'Supports TXT / Markdown / HTML / DOCX', ja: 'TXT / Markdown / HTML / DOCX に対応' },
        '选择 PDF，导出纯文本': { en: 'Choose a PDF to export as plain text', ja: 'PDF を選んでテキストを書き出す' },
        '按页提取文字，图片型 PDF 无法识别': { en: 'Extracts text page by page; image-only PDFs are not supported', ja: 'ページごとに文字を抽出。画像のみの PDF は非対応です' },
        'A4 纸张': { en: 'A4 paper', ja: 'A4 用紙' },
        '按图片尺寸': { en: 'Image size', ja: '画像サイズ' },
        'TXT 纯文本': { en: 'TXT plain text', ja: 'TXT テキスト' },
        '页面尺寸': { en: 'Page size', ja: 'ページサイズ' },
        '导出格式': { en: 'Export format', ja: '出力形式' },
        '重选': { en: 'Choose again', ja: '選び直す' },
        '文件会在浏览器本地处理，不会上传服务器。': { en: 'Files are processed locally and never uploaded.', ja: 'ファイルはブラウザ内で処理され、サーバーには送信されません。' },
        '已选择文件，点「开始转换」。': { en: 'File selected. Click "Start conversion".', ja: 'ファイルを選択しました。「変換を開始」を押してください。' },
        '转换完成，点击右侧按钮下载。': { en: 'Done. Click the button on the right to download.', ja: '変換完了。右側のボタンからダウンロードしてください。' },
        'PDF 已生成，点击右侧按钮下载。': { en: 'PDF created. Click the button on the right to download.', ja: 'PDF を作成しました。右側のボタンからダウンロードしてください。' },
        '提取完成。图片型 PDF 没有文字层，结果可能为空。': { en: 'Extraction complete. Image-only PDFs have no text layer, so results may be empty.', ja: '抽出完了。画像のみの PDF にはテキスト層がないため、結果が空の場合があります。' },
        '正在排版文档…': { en: 'Laying out the document...', ja: '文書をレイアウト中...' },
        '正在生成页面图片…': { en: 'Rendering pages...', ja: 'ページ画像を生成中...' },
        '处理中…': { en: 'Processing...', ja: '処理中...' },
        '处理失败：': { en: 'Processing failed: ', ja: '処理に失敗しました：' },
        '浏览器无法解码相机 RAW（.cr2 / .nef / .arw），请先导出为 JPG 或 TIFF 再转换。': {
            en: 'Browsers cannot decode camera RAW (.cr2 / .nef / .arw). Export to JPG or TIFF first.',
            ja: 'ブラウザはカメラ RAW（.cr2 / .nef / .arw）を扱えません。JPG か TIFF に書き出してから変換してください。'
        },

        /* 解压工具 */
        '全部在浏览器本地解压，文件不会上传服务器': { en: 'All extraction happens locally; files are never uploaded', ja: 'すべてブラウザ内で解凍され、ファイルはサーバーに送信されません' },
        '压缩包': { en: 'Archives', ja: '圧縮ファイル' },
        '光盘 / 镜像': { en: 'Disc / image', ja: 'ディスク・イメージ' },
        '应用与软件包': { en: 'Apps & packages', ja: 'アプリ・パッケージ' },
        '点击选择文件，或拖到这里': { en: 'Click to choose a file, or drop it here', ja: 'ファイルを選択、またはここにドロップ' },
        '选择一个文件，或直接拖进来；没选格式时按内容自动识别': { en: 'Choose a file or drop it in; the format is detected from content', ja: 'ファイルを選択するかドロップしてください。形式は内容から自動判別します' },
        '解压密码': { en: 'Password', ja: 'パスワード' },
        '加密压缩包才需要填写': { en: 'Only for encrypted archives', ja: '暗号化された圧縮ファイルのみ入力' },
        '文件会在浏览器本地解压，不会上传服务器。': { en: 'Files are extracted locally and never uploaded.', ja: 'ファイルはブラウザ内で解凍され、サーバーには送信されません。' },
        '开始解压': { en: 'Start extraction', ja: '解凍を開始' },
        '支持 ZIP / JAR / WAR / APK / IPA / TAR / TAR.GZ / TGZ / GZ / 7Z / RAR / CAB / ISO / IMG / BIN / DEB / RPM / XAR 等。VDI / VMDK / VHD / VHDX / QCOW2 / DMG / WIM 是磁盘镜像，浏览器无法直接解析。': {
            en: 'Supports ZIP / JAR / WAR / APK / IPA / TAR / TAR.GZ / TGZ / GZ / 7Z / RAR / CAB / ISO / IMG / BIN / DEB / RPM / XAR and more. VDI / VMDK / VHD / VHDX / QCOW2 / DMG / WIM are disk images that browsers cannot parse.',
            ja: 'ZIP / JAR / WAR / APK / IPA / TAR / TAR.GZ / TGZ / GZ / 7Z / RAR / CAB / ISO / IMG / BIN / DEB / RPM / XAR などに対応。VDI / VMDK / VHD / VHDX / QCOW2 / DMG / WIM はディスクイメージのため、ブラウザでは解析できません。'
        },
        '解压 ZIP': { en: 'Extract ZIP', ja: 'ZIP を解凍' },
        '常见的 ZIP 压缩包，含 DOCX / XLSX / EPUB': { en: 'Common ZIP archives, including DOCX / XLSX / EPUB', ja: '一般的な ZIP。DOCX / XLSX / EPUB も含む' },
        '解压 JAR / WAR': { en: 'Extract JAR / WAR', ja: 'JAR / WAR を解凍' },
        'Java 应用包，本质是 ZIP 结构': { en: 'Java application packages (ZIP structure)', ja: 'Java アプリのパッケージ（実体は ZIP）' },
        '解压 TAR': { en: 'Extract TAR', ja: 'TAR を解凍' },
        '保留目录结构展开 tar 归档': { en: 'Extracts tar archives preserving directories', ja: 'ディレクトリ構造を保って展開' },
        '解压 TAR.GZ / TGZ': { en: 'Extract TAR.GZ / TGZ', ja: 'TAR.GZ / TGZ を解凍' },
        '先解 gzip，再展开里面的 tar': { en: 'Decompress gzip, then unpack the tar', ja: 'gzip を解いて中の tar を展開' },
        '解压 7Z': { en: 'Extract 7Z', ja: '7Z を解凍' },
        '读取 7z 压缩包，支持加密包': { en: 'Reads 7z archives, including encrypted ones', ja: '7z を読み取り（暗号化にも対応）' },
        '解压 RAR': { en: 'Extract RAR', ja: 'RAR を解凍' },
        '支持 RAR / RAR5 压缩包': { en: 'Supports RAR / RAR5 archives', ja: 'RAR / RAR5 に対応' },
        '解压 CAB': { en: 'Extract CAB', ja: 'CAB を解凍' },
        'Windows 安装包里的 cabinet 归档': { en: 'Cabinet archives from Windows installers', ja: 'Windows インストーラの cabinet アーカイブ' },
        '自动识别': { en: 'Auto detect', ja: '自動判別' },
        '不确定格式就选这个，按内容自动判断': { en: 'Pick this if unsure; the format is detected from content', ja: '形式が不明ならこれを選択。内容から自動判別します' },
        '打开 ISO': { en: 'Open ISO', ja: 'ISO を開く' },
        '浏览并提取 ISO 9660 光盘镜像': { en: 'Browse and extract ISO 9660 disc images', ja: 'ISO 9660 ディスクイメージを閲覧・抽出' },
        '打开 IMG / BIN': { en: 'Open IMG / BIN', ja: 'IMG / BIN を開く' },
        '标准 ISO 9660 的 img / bin 镜像可用': { en: 'Works with standard ISO 9660 img / bin images', ja: '標準的な ISO 9660 の img / bin に対応' },
        '打开 APK': { en: 'Open APK', ja: 'APK を開く' },
        '提取安卓安装包里的文件': { en: 'Extract files from Android packages', ja: 'Android パッケージ内のファイルを抽出' },
        '打开 IPA': { en: 'Open IPA', ja: 'IPA を開く' },
        '提取 iOS 应用包里的文件': { en: 'Extract files from iOS app packages', ja: 'iOS アプリパッケージ内のファイルを抽出' },
        '打开 DEB': { en: 'Open DEB', ja: 'DEB を開く' },
        'Debian 软件包（ar 归档结构）': { en: 'Debian packages (ar archive)', ja: 'Debian パッケージ（ar アーカイブ）' },
        '打开 RPM': { en: 'Open RPM', ja: 'RPM を開く' },
        '浏览 RPM 软件包内容': { en: 'Browse RPM package contents', ja: 'RPM パッケージの内容を閲覧' },
        '打开 XAR / PKG': { en: 'Open XAR / PKG', ja: 'XAR / PKG を開く' },
        'macOS 安装包归档': { en: 'macOS installer archives', ja: 'macOS インストーラのアーカイブ' },
        '解压中': { en: 'Extracting', ja: '解凍中' },
        '解压中…': { en: 'Extracting...', ja: '解凍中...' },
        '已下载': { en: 'Downloaded', ja: 'ダウンロード済み' },
        '失败': { en: 'Failed', ja: '失敗' },
        '正在加载解压引擎…': { en: 'Loading extraction engine...', ja: '解凍エンジンを読み込み中...' },
        '正在读取压缩包…': { en: 'Reading archive...', ja: '圧縮ファイルを読み込み中...' },
        '这个压缩包已加密，请填写密码后再点「开始解压」。': { en: 'This archive is encrypted. Enter the password, then click "Start extraction".', ja: 'この圧縮ファイルは暗号化されています。パスワードを入力して「解凍を開始」を押してください。' },
        '没有读到可解压的文件，可能是空包或格式不被支持。': { en: 'No extractable files found. The archive may be empty or unsupported.', ja: '解凍できるファイルがありません。空か未対応の形式かもしれません。' },
        '解压失败：压缩包已加密，请填写密码后重试。': { en: 'Extraction failed: the archive is encrypted. Enter the password and retry.', ja: '解凍失敗：暗号化されています。パスワードを入力して再試行してください。' },
        '解压失败：': { en: 'Extraction failed: ', ja: '解凍に失敗しました：' },
        '（该格式可能不被支持）': { en: ' (this format may be unsupported)', ja: '（この形式は未対応の可能性があります）' },
        '正在读取全部文件…': { en: 'Reading all files...', ja: 'すべてのファイルを読み込み中...' },
        '已打包完成，浏览器开始下载。': { en: 'Packaging complete. Your browser is downloading.', ja: 'パッケージ化完了。ダウンロードが始まります。' },
        '打包失败：': { en: 'Packaging failed: ', ja: 'パッケージ化に失敗しました：' },

        /* 翻译页 */
        '由站内 AI 完成翻译，内容只用于本次结果，不会保存': { en: 'Translated by the site AI. Content is used only for this result and is never saved', ja: 'サイト内 AI が翻訳します。内容は今回の結果にのみ使用され、保存されません' },
        '源语言': { en: 'Source language', ja: '原文の言語' },
        '交换语言': { en: 'Swap languages', ja: '言語を入れ替え' },
        '目标语言': { en: 'Target language', ja: '訳先の言語' },
        '输入要翻译的内容，Ctrl + Enter 也可以直接翻译': { en: 'Enter text to translate. Ctrl + Enter also works', ja: '翻訳する内容を入力。Ctrl + Enter でも翻訳できます' },
        '译文会显示在这里': { en: 'The translation appears here', ja: '訳文がここに表示されます' },
        '复制译文': { en: 'Copy translation', ja: '訳文をコピー' },
        '支持中文、英语、日语、韩语、法语、德语、俄语等常用语言互译。': { en: 'Supports translation among Chinese, English, Japanese, Korean, French, German, Russian and more.', ja: '中国語・英語・日本語・韓国語・フランス語・ドイツ語・ロシア語などの相互翻訳に対応。' },
        '开始翻译': { en: 'Translate', ja: '翻訳する' },
        '翻译中…': { en: 'Translating...', ja: '翻訳中...' },
        '正在翻译，稍等一下…': { en: 'Translating. One moment...', ja: '翻訳中です。少々お待ちください...' },
        '翻译完成。': { en: 'Translation complete.', ja: '翻訳が完了しました。' },
        '翻译失败，请稍后再试。': { en: 'Translation failed. Please try again later.', ja: '翻訳に失敗しました。しばらくしてから再試行してください。' },
        '已交换源语言和目标语言。': { en: 'Swapped source and target languages.', ja: '原文と訳先の言語を入れ替えました。' },
        '先在左边输入要翻译的内容。': { en: 'Enter the text to translate on the left first.', ja: '左側に翻訳する内容を入力してください。' },
        '源语言和目标语言相同，已直接填入原文。': { en: 'Source and target are the same; the original text was copied.', ja: '原文と訳先が同じため、原文をそのまま入力しました。' },
        '还没有译文可以复制。': { en: 'There is no translation to copy yet.', ja: 'コピーできる訳文がまだありません。' },
        '译文已复制。': { en: 'Translation copied.', ja: '訳文をコピーしました。' },
        '复制失败，请手动选中复制。': { en: 'Copy failed. Please select and copy manually.', ja: 'コピーに失敗しました。手動で選択してコピーしてください。' },
        '内容太长了，请控制在 4000 字以内。': { en: 'The text is too long. Keep it under 4000 characters.', ja: '内容が長すぎます。4000 文字以内にしてください。' },
        '自动检测': { en: 'Auto detect', ja: '自動検出' },
        '中文': { en: 'Chinese', ja: '中国語' },
        '英语': { en: 'English', ja: '英語' },
        '日语': { en: 'Japanese', ja: '日本語' },
        '韩语': { en: 'Korean', ja: '韓国語' },
        '法语': { en: 'French', ja: 'フランス語' },
        '德语': { en: 'German', ja: 'ドイツ語' },
        '西班牙语': { en: 'Spanish', ja: 'スペイン語' },
        '俄语': { en: 'Russian', ja: 'ロシア語' },
        '葡萄牙语': { en: 'Portuguese', ja: 'ポルトガル語' },
        '意大利语': { en: 'Italian', ja: 'イタリア語' },
        '阿拉伯语': { en: 'Arabic', ja: 'アラビア語' },
        '泰语': { en: 'Thai', ja: 'タイ語' },

        /* 账号 / 用户中心 */
        '密码登录': { en: 'Password login', ja: 'パスワードでログイン' },
        '验证码登录': { en: 'Code login', ja: '認証コードでログイン' },
        '注册': { en: 'Register', ja: '登録' },
        '用户名': { en: 'Username', ja: 'ユーザー名' },
        '密码': { en: 'Password', ja: 'パスワード' },
        '登录': { en: 'Log in', ja: 'ログイン' },
        '注册时的邮箱': { en: 'Email used at registration', ja: '登録時のメールアドレス' },
        '6位验证码': { en: '6-digit code', ja: '6 桁のコード' },
        '6 位验证码': { en: '6-digit code', ja: '6 桁のコード' },
        '获取验证码': { en: 'Get code', ja: 'コードを取得' },
        '密码（至少 6 位）': { en: 'Password (at least 6 characters)', ja: 'パスワード（6 文字以上）' },
        '邮箱': { en: 'Email', ja: 'メールアドレス' },
        '点击上传': { en: 'Click to upload', ja: 'クリックでアップロード' },
        '发帖': { en: 'Posts', ja: '投稿' },
        '今日 AI': { en: 'AI today', ja: '本日の AI' },
        '个人资料': { en: 'Profile', ja: 'プロフィール' },
        '个性签名': { en: 'Signature', ja: 'ひとこと' },
        '介绍一下自己吧...': { en: 'Introduce yourself...', ja: '自己紹介を書いてみましょう...' },
        '生日': { en: 'Birthday', ja: '誕生日' },
        '头像点左上角圆形区域上传，会自动裁成正方形。': { en: 'Click the circle at the top left to upload an avatar; it is cropped to a square automatically.', ja: '左上の丸い部分をクリックしてアバターをアップロードします。自動で正方形に切り抜かれます。' },
        '保存资料': { en: 'Save profile', ja: 'プロフィールを保存' },
        '今日 AI 额度': { en: 'Today\u2019s AI quota', ja: '本日の AI 利用枠' },
        '条': { en: '', ja: '件' },
        '每天 0 点重置，聊天记录会自动保存。': { en: 'Resets at midnight; chat history is saved automatically.', ja: '毎日 0 時にリセットされ、履歴は自動保存されます。' },
        '更换绑定邮箱': { en: 'Change email', ja: 'メールアドレス変更' },
        '验证码会发送到新邮箱，收不到就翻一下垃圾箱。': { en: 'The code is sent to the new email. Check your spam folder if you do not see it.', ja: '認証コードは新しいメールに送信されます。届かない場合は迷惑メールもご確認ください。' },
        '新邮箱': { en: 'New email', ja: '新しいメールアドレス' },
        '绑定': { en: 'Bind', ja: '登録' },
        '修改密码': { en: 'Change password', ja: 'パスワード変更' },
        '当前密码': { en: 'Current password', ja: '現在のパスワード' },
        '新密码（至少 6 位）': { en: 'New password (at least 6 characters)', ja: '新しいパスワード（6 文字以上）' },
        '注销账号': { en: 'Delete account', ja: 'アカウント削除' },
        '注销后账号、帖子和聊天记录都会删除，不能恢复。请输入用户名确认。': { en: 'Your account, posts and chat history will be deleted permanently. Enter your username to confirm.', ja: 'アカウント・投稿・履歴はすべて削除され、元に戻せません。確認のためユーザー名を入力してください。' },
        '输入用户名': { en: 'Enter username', ja: 'ユーザー名を入力' },
        '未登录': { en: 'Guest', ja: 'ゲスト' },
        '登录 / 注册': { en: 'Log in / Register', ja: 'ログイン / 登録' },
        '退出': { en: 'Log out', ja: 'ログアウト' },
        '加入于': { en: 'Joined', ja: '登録日' },
        '绑定邮箱：': { en: 'Email: ', ja: 'メール：' },
        '未绑定': { en: 'Not bound', ja: '未登録' },
        '用户名密码注册与登录': { en: 'Username and password registration and login', ja: 'ユーザー名とパスワードで登録・ログイン' },

        /* 账号提示 */
        '请填写完整': { en: 'Please fill in all fields', ja: 'すべて入力してください' },
        '请填写完整信息': { en: 'Please fill in all the information', ja: 'すべての項目を入力してください' },
        '登录失败': { en: 'Login failed', ja: 'ログインに失敗しました' },
        '注册失败': { en: 'Registration failed', ja: '登録に失敗しました' },
        '注册成功，请用密码登录': { en: 'Registered. Please log in with your password.', ja: '登録しました。パスワードでログインしてください。' },
        '网络请求失败': { en: 'Network error', ja: '通信に失敗しました' },
        '发送中...': { en: 'Sending...', ja: '送信中...' },
        '验证码已发送': { en: 'Verification code sent', ja: '認証コードを送信しました' },
        '发送失败': { en: 'Failed to send', ja: '送信に失敗しました' },
        '请先填写邮箱': { en: 'Please enter your email first', ja: '先にメールアドレスを入力してください' },
        '保存成功': { en: 'Saved', ja: '保存しました' },
        '保存失败，请检查网络': { en: 'Failed to save. Check your network.', ja: '保存に失敗しました。通信を確認してください' },
        '请输入当前用户名以确认注销': { en: 'Enter your current username to confirm deletion', ja: '削除の確認のため現在のユーザー名を入力してください' },
        '注销后账号和你的帖子都会删除，且不能恢复。确定继续？': { en: 'Your account and posts will be deleted permanently. Continue?', ja: 'アカウントと投稿は削除され、元に戻せません。続行しますか？' },
        '账号已注销': { en: 'Account deleted', ja: 'アカウントを削除しました' },
        '注销失败': { en: 'Failed to delete account', ja: 'アカウントの削除に失敗しました' },
        '注销失败，请检查网络': { en: 'Failed to delete account. Check your network.', ja: 'アカウントの削除に失敗しました。通信を確認してください' },
        '请填写新邮箱和验证码': { en: 'Please enter the new email and code', ja: '新しいメールアドレスと認証コードを入力してください' },
        '绑定失败': { en: 'Failed to bind', ja: '登録に失敗しました' },
        '绑定失败，请检查网络': { en: 'Failed to bind. Check your network.', ja: '登録に失敗しました。通信を確認してください' },
        '邮箱已更新': { en: 'Email updated', ja: 'メールアドレスを更新しました' },
        '请填写当前密码和新密码': { en: 'Please enter the current and new passwords', ja: '現在のパスワードと新しいパスワードを入力してください' },
        '新密码至少 6 位': { en: 'The new password must be at least 6 characters', ja: '新しいパスワードは 6 文字以上にしてください' },
        '修改失败': { en: 'Failed to change', ja: '変更に失敗しました' },
        '修改失败，请检查网络': { en: 'Failed to change. Check your network.', ja: '変更に失敗しました。通信を確認してください' },
        '密码已修改，请用新密码重新登录': { en: 'Password changed. Please log in again with the new password.', ja: 'パスワードを変更しました。新しいパスワードで再ログインしてください。' },
        '登录已过期，请重新登录': { en: 'Session expired. Please log in again.', ja: 'ログインの有効期限が切れました。再度ログインしてください。' },
        '加载失败': { en: 'Failed to load', ja: '読み込みに失敗しました' },
        '网络请求失败，请检查后端是否启动': { en: 'Network error. Check whether the server is running.', ja: '通信に失敗しました。サーバーが起動しているか確認してください。' },
        '分配失败，请刷新': { en: 'Assignment failed. Please refresh.', ja: '割り当てに失敗しました。再読み込みしてください。' },
        '这张图片无法裁切': { en: 'This image cannot be cropped', ja: 'この画像は切り抜けません' },
        '用中间这一块做头像': { en: 'Use the center area as your avatar', ja: '中央の範囲をアバターにします' },
        '取消': { en: 'Cancel', ja: 'キャンセル' },
        '就用这张': { en: 'Use this one', ja: 'これを使う' },

        /* 页脚 */
        '举报请联系网站管理员': { en: 'Contact the site administrator to report issues', ja: '通報はサイト管理者までご連絡ください' },
        '本网站已通过ICP备案，备案码：': { en: 'ICP filing number: ', ja: 'ICP 登録番号：' },

        /* 更新日志标签 */
        '最新': { en: 'Latest', ja: '最新' },
        '新增': { en: 'New', ja: '新機能' },
        '说明': { en: 'Note', ja: '説明' },
        '修复': { en: 'Fix', ja: '修正' },
        '调整': { en: 'Tweak', ja: '調整' },
        '清理': { en: 'Cleanup', ja: '整理' },
        '优化': { en: 'Improve', ja: '改善' },
        '首发': { en: 'Release', ja: '初版' }
    };

    /* 带变量的句子：用正则匹配后再翻译 */
    const PATTERNS = [
        {
            re: /^今日剩余 (\d+) 条$/,
            en: (m) => m[1] + ' left today',
            ja: (m) => '本日あと ' + m[1] + ' 件'
        },
        {
            re: /^(\d+)秒$/,
            en: (m) => m[1] + 's',
            ja: (m) => m[1] + '秒'
        },
        {
            re: /^已载入视频：(\d+)×(\d+)，拖动进度条选好画面后点「截取当前帧」。$/,
            en: (m) => 'Video loaded: ' + m[1] + '×' + m[2] + '. Drag the slider and click "Capture current frame".',
            ja: (m) => '動画を読み込みました：' + m[1] + '×' + m[2] + '。スライダーで画面を選び「現在のフレームを保存」を押してください。'
        },
        {
            re: /^正在处理 (\d+) \/ (\d+)…$/,
            en: (m) => 'Processing ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' を処理中...'
        },
        {
            re: /^正在合成第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Building page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を合成中...'
        },
        {
            re: /^正在导出第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Exporting page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を書き出し中...'
        },
        {
            re: /^正在生成第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Rendering page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を生成中...'
        },
        {
            re: /^正在提取第 (\d+) \/ (\d+) 页…$/,
            en: (m) => 'Extracting page ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ページ目を抽出中...'
        },
        {
            re: /^导出完成，共 (\d+) 张图片。$/,
            en: (m) => 'Export complete. ' + m[1] + ' image(s).',
            ja: (m) => '書き出し完了。画像 ' + m[1] + ' 枚。'
        },
        {
            re: /^已选择「(.+)」，点上方虚线区域选择文件。$/,
            en: (m) => 'Selected "' + tr(m[1]) + '". Click the dashed area above to choose a file.',
            ja: (m) => '「' + tr(m[1]) + '」を選択しました。上の点線エリアからファイルを選択してください。'
        },
        {
            re: /^读取完成：共 (\d+) 个文件，可单独下载或全部打包下载。$/,
            en: (m) => 'Done: ' + m[1] + ' file(s). Download individually or as a ZIP.',
            ja: (m) => '読み込み完了：' + m[1] + ' ファイル。個別または ZIP でまとめてダウンロードできます。'
        },
        {
            re: /^正在读取 (\d+) \/ (\d+) 个文件…$/,
            en: (m) => 'Reading file ' + m[1] + ' / ' + m[2] + '...',
            ja: (m) => m[1] + ' / ' + m[2] + ' ファイルを読み込み中...'
        },
        {
            re: /^正在打包 (\d+)%…$/,
            en: (m) => 'Packaging ' + m[1] + '%...',
            ja: (m) => 'パッケージ化 ' + m[1] + '%...'
        },
        {
            re: /^(\d+) 个文件 · (.+)$/,
            en: (m) => m[1] + ' file(s) · ' + m[2],
            ja: (m) => m[1] + ' ファイル · ' + m[2]
        },
        {
            re: /^选择 (.+) 文件$/,
            en: (m) => 'Choose ' + m[1] + ' file',
            ja: (m) => m[1] + ' ファイルを選択'
        }
    ];

    /* ---------------- 原文记录，用于切回中文 ---------------- */
    const ORIG_TEXT = new WeakMap();
    const ORIG_ATTR = new WeakMap();
    const ATTRS = ['placeholder', 'title', 'aria-label'];
    const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, IFRAME: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };

    function shouldSkip(el) {
        if (!el || el.nodeType !== 1) return false;
        if (SKIP_TAGS[el.tagName]) return true;
        if (el.id === 'lang-select' || el.closest('#lang-select')) return true;
        if (el.hasAttribute('data-no-i18n')) return true;
        return false;
    }

    function translateValue(text) {
        if (!text) return null;
        const hit = WORDS[text];
        if (hit) return hit[lang] != null ? hit[lang] : null;
        for (let i = 0; i < PATTERNS.length; i++) {
            const p = PATTERNS[i];
            const m = text.match(p.re);
            if (m) return p[lang](m);
        }
        return null;
    }

    /* 页面内部使用：把中文短语翻成当前语言 */
    function tr(text) {
        if (lang === 'zh') return text;
        const out = translateValue(String(text));
        return out == null ? text : out;
    }

    function localizeTextNode(node) {
        const parent = node.parentNode;
        if (!parent || shouldSkip(parent)) return;
        const cur = node.nodeValue;
        const key = cur.trim();
        if (!key) return;
        if (lang === 'zh') return;
        const out = translateValue(key);
        if (out != null) {
            if (!ORIG_TEXT.has(node)) ORIG_TEXT.set(node, cur);
            const start = cur.indexOf(key);
            const next = cur.slice(0, start) + out + cur.slice(start + key.length);
            if (next !== cur) node.nodeValue = next;
        } else if (CJK.test(key) && !ORIG_TEXT.has(node)) {
            ORIG_TEXT.set(node, cur);
        }
    }

    function localizeText(root) {
        if (!root) return;
        if (root.nodeType === 3) { localizeTextNode(root); return; }
        if (root.nodeType !== 1 || shouldSkip(root)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node) {
            localizeTextNode(node);
            node = walker.nextNode();
        }
    }

    function localizeAttrs(root) {
        if (!root || root.nodeType !== 1 || shouldSkip(root)) return;
        const list = [root].concat(Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title],[aria-label]')));
        list.forEach((el) => {
            if (shouldSkip(el)) return;
            let saved = ORIG_ATTR.get(el);
            ATTRS.forEach((attr) => {
                const cur = el.getAttribute(attr);
                if (!cur) return;
                if (lang === 'zh') {
                    if (saved && saved[attr] != null) el.setAttribute(attr, saved[attr]);
                    return;
                }
                const out = translateValue(cur.trim());
                if (out == null) {
                    if (CJK.test(cur)) {
                        saved = saved || {};
                        if (saved[attr] == null) saved[attr] = cur;
                        ORIG_ATTR.set(el, saved);
                    }
                    return;
                }
                saved = saved || {};
                if (saved[attr] == null) saved[attr] = cur;
                ORIG_ATTR.set(el, saved);
                if (out !== cur) el.setAttribute(attr, out);
            });
        });
    }

    function restoreAll() {
        const root = document.body;
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node) {
            if (ORIG_TEXT.has(node)) node.nodeValue = ORIG_TEXT.get(node);
            node = walker.nextNode();
        }
        const els = root.querySelectorAll('[placeholder],[title],[aria-label]');
        Array.prototype.forEach.call(els, (el) => {
            const saved = ORIG_ATTR.get(el);
            if (!saved) return;
            ATTRS.forEach((attr) => {
                if (saved[attr] != null) el.setAttribute(attr, saved[attr]);
            });
        });
    }

    let pageZh = '';

    function setPageTitle(zh) {
        pageZh = zh || pageZh;
        const el = document.getElementById('page-title');
        if (!el) return;
        el.textContent = tr(pageZh);
    }

    function zhTextOf(el) {
        if (!el) return '';
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node) {
            if (node.nodeValue && node.nodeValue.trim()) {
                return ORIG_TEXT.get(node) || node.nodeValue.trim();
            }
            node = walker.nextNode();
        }
        return el.textContent.trim();
    }

    /* ---------------- 应用语言 ---------------- */
    function applyLang(next) {
        if (LANGS.indexOf(next) < 0) next = 'zh';
        lang = next;
        try { localStorage.setItem(KEY_LANG, next); } catch (e) { /* 忽略隐私模式限制 */ }
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
        const sel = document.getElementById('lang-select');
        if (sel && sel.value !== next) sel.value = next;

        applying = true;
        if (observer) observer.disconnect();
        restoreAll();
        if (next !== 'zh' && document.body) {
            localizeText(document.body);
            localizeAttrs(document.body);
        }
        if (pageZh) setPageTitle(pageZh);
        applying = false;
        observe();

        document.title = tr('日向论坛');
        if (typeof window.refreshDynamicLang === 'function') window.refreshDynamicLang();
    }

    function currentLang() {
        return lang;
    }

    /* ---------------- 监听新插入的内容 ---------------- */
    function observe() {
        if (!observer || !document.body) return;
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ATTRS
        });
    }

    function onMutations() {
        if (lang === 'zh' || applying) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
            applying = true;
            if (observer) observer.disconnect();
            localizeText(document.body);
            localizeAttrs(document.body);
            applying = false;
            observe();
        }, 100);
    }

    /* ---------------- 主题 ---------------- */
    function setTheme(mode) {
        const next = mode === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem(KEY_THEME, next); } catch (e) { /* 忽略 */ }
    }

    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark');
    }

    /* ---------------- 初始化 ---------------- */
    function init() {
        let savedLang = 'zh';
        try { savedLang = localStorage.getItem(KEY_LANG) || 'zh'; } catch (e) { /* 忽略 */ }
        if (LANGS.indexOf(savedLang) < 0) savedLang = 'zh';

        if (window.MutationObserver) {
            observer = new MutationObserver(onMutations);
        }

        const active = document.querySelector('.nav-item.active .nav-text') || document.querySelector('.nav-item .nav-text');
        pageZh = zhTextOf(active) || '首页大厅';

        applyLang(savedLang);
        if (!document.documentElement.getAttribute('data-theme')) setTheme('light');
    }

    window.applyLang = applyLang;
    window.toggleTheme = toggleTheme;
    window.setTheme = setTheme;
    window.getLang = currentLang;
    window.tr = tr;
    window.t = tr;
    window.setPageTitle = setPageTitle;
    window.zhTextOf = zhTextOf;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
