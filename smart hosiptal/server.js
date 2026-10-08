/* ==========================================
   SMART HOSPITAL SERVER
   Static Server + SerpApi Proxy
========================================== */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");


/* ==========================================
   CONFIGURATION
========================================== */

const PORT = 3000;


/*
 * IMPORTANT:
 * Put your NEW / ROTATED SerpApi key here.
 *
 * Do NOT put the key inside index.html
 * or script.js.
 */

const SERPAPI_KEY =
    "e73c66927ee11cc4e688d7af78a2898b5c6d53083a67bac75d1f5cb50813c1a3";


/*
 * Project root is one folder above
 * the server folder.
 */

const ROOT_DIR =
    path.join(__dirname, "..");


/* ==========================================
   MIME TYPES
========================================== */

const MIME_TYPES = {

    ".html":
        "text/html; charset=utf-8",

    ".css":
        "text/css; charset=utf-8",

    ".js":
        "application/javascript; charset=utf-8",

    ".json":
        "application/json; charset=utf-8",

    ".png":
        "image/png",

    ".jpg":
        "image/jpeg",

    ".jpeg":
        "image/jpeg",

    ".gif":
        "image/gif",

    ".svg":
        "image/svg+xml",

    ".webp":
        "image/webp",

    ".ico":
        "image/x-icon"

};


/* ==========================================
   SEND JSON
========================================== */

function sendJSON(
    response,
    statusCode,
    data
) {

    response.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Access-Control-Allow-Origin":
                "*"
        }
    );


    response.end(
        JSON.stringify(data)
    );

}


/* ==========================================
   HTTPS GET
========================================== */

function httpsGet(url) {

    return new Promise(
        function(resolve, reject) {

            https.get(
                url,
                function(response) {

                    let data = "";


                    response.on(
                        "data",
                        function(chunk) {

                            data += chunk;

                        }
                    );


                    response.on(
                        "end",
                        function() {

                            resolve({

                                statusCode:
                                    response.statusCode,

                                data: data

                            });

                        }
                    );

                }
            ).on(
                "error",
                function(error) {

                    reject(error);

                }
            );

        }
    );

}


/* ==========================================
   SERPAPI HOSPITAL API
========================================== */

async function handleHospitalAPI(
    requestURL,
    response
) {

    try {

        if (
            !SERPAPI_KEY ||
            SERPAPI_KEY ===
            "YOUR_NEW_SERPAPI_KEY"
        ) {

            sendJSON(
                response,
                500,
                {
                    error:
                        "SerpApi key is not configured in server.js"
                }
            );

            return;

        }


        const query =
            requestURL.searchParams.get("q");


        const lat =
            requestURL.searchParams.get("lat");


        const lng =
            requestURL.searchParams.get("lng");


        /*
         * Default search
         */

        let searchQuery =
            "hospitals";


        /*
         * Google Maps location parameter
         */

        let ll = null;


        /*
         * If GPS coordinates exist,
         * search near that location.
         */

        if (
            lat &&
            lng
        ) {

            searchQuery =
                query ||
                "hospitals near me";


            ll =
                `@${lat},${lng},14z`;

        }

        else if (
            query
        ) {

            searchQuery =
                query;

        }


        /*
         * Build SerpApi URL
         */

        const params =
            new URLSearchParams({

                engine:
                    "google_maps",

                type:
                    "search",

                q:
                    searchQuery,

                api_key:
                    SERPAPI_KEY,

                hl:
                    "en",

                google_domain:
                    "google.com"

            });


        if (ll) {

            params.set(
                "ll",
                ll
            );

        }


        const serpApiURL =
            `https://serpapi.com/search.json?${params.toString()}`;


        console.log(
            "\n🏥 SerpApi hospital request"
        );

        console.log(
            "Search:",
            searchQuery
        );


        if (ll) {

            console.log(
                "Location:",
                ll
            );

        }


        /*
         * Request SerpApi
         */

        const result =
            await httpsGet(
                serpApiURL
            );


        console.log(
            "SerpApi HTTP:",
            result.statusCode
        );


        let json;


        try {

            json =
                JSON.parse(
                    result.data
                );

        }

        catch (parseError) {

            sendJSON(
                response,
                502,
                {

                    error:
                        "Invalid response from SerpApi.",

                    raw:
                        result.data

                }
            );

            return;

        }


        /*
         * SerpApi error
         */

        if (
            result.statusCode !== 200
        ) {

            sendJSON(
                response,
                result.statusCode,
                json
            );

            return;

        }


        /*
         * Successful result
         */

        sendJSON(
            response,
            200,
            json
        );

    }

    catch (error) {

        console.error(
            "SerpApi Error:",
            error
        );


        sendJSON(
            response,
            500,
            {

                error:
                    "Hospital API request failed.",

                details:
                    error.message

            }
        );

    }

}


/* ==========================================
   STATIC FILE SERVER
========================================== */

function serveStaticFile(
    requestPath,
    response
) {

    /*
     * Decode URL
     */

    let cleanPath;


    try {

        cleanPath =
            decodeURIComponent(
                requestPath
            );

    }

    catch (error) {

        response.writeHead(400);

        response.end(
            "Bad Request"
        );

        return;

    }


    /*
     * Remove leading slash.
     *
     * IMPORTANT:
     * This fixes the path problem.
     */

    cleanPath =
        cleanPath.replace(
            /^\/+/,
            ""
        );


    /*
     * Empty path means index.html
     */

    if (
        cleanPath === ""
    ) {

        cleanPath =
            "index.html";

    }


    /*
     * Build absolute file path.
     */

    const filePath =
        path.join(
            ROOT_DIR,
            cleanPath
        );


    /*
     * Security check.
     *
     * Prevent access outside project folder.
     */

    const normalizedRoot =
        path.resolve(
            ROOT_DIR
        );


    const normalizedFile =
        path.resolve(
            filePath
        );


    if (
        normalizedFile !== normalizedRoot &&
        !normalizedFile.startsWith(
            normalizedRoot +
            path.sep
        )
    ) {

        response.writeHead(403);

        response.end(
            "Forbidden"
        );

        return;

    }


    /*
     * Check file
     */

    fs.stat(
        filePath,
        function(error, stats) {

            if (error) {

                console.log(
                    "404:",
                    cleanPath
                );


                response.writeHead(
                    404,
                    {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                );


                response.end(
                    "404 - File Not Found: " +
                    cleanPath
                );


                return;

            }


            /*
             * If someone requests a directory,
             * serve index.html inside it.
             */

            if (
                stats.isDirectory()
            ) {

                const indexFile =
                    path.join(
                        filePath,
                        "index.html"
                    );


                fs.readFile(
                    indexFile,
                    function(
                        indexError,
                        content
                    ) {

                        if (indexError) {

                            response.writeHead(
                                403
                            );

                            response.end(
                                "Directory access denied"
                            );

                            return;

                        }


                        response.writeHead(
                            200,
                            {
                                "Content-Type":
                                    "text/html; charset=utf-8"
                            }
                        );


                        response.end(
                            content
                        );

                    }
                );


                return;

            }


            /*
             * Read normal file
             */

            fs.readFile(
                filePath,
                function(
                    readError,
                    content
                ) {

                    if (readError) {

                        response.writeHead(
                            500
                        );

                        response.end(
                            "Server Error"
                        );

                        return;

                    }


                    const extension =
                        path.extname(
                            filePath
                        ).toLowerCase();


                    const contentType =
                        MIME_TYPES[
                            extension
                        ] ||
                        "application/octet-stream";


                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                contentType,

                            "Cache-Control":
                                "no-cache"
                        }
                    );


                    response.end(
                        content
                    );

                }
            );

        }
    );

}


/* ==========================================
   CREATE SERVER
========================================== */

const server =
    http.createServer(
        async function(
            request,
            response
        ) {

            try {

                const requestURL =
                    new URL(
                        request.url,
                        `http://localhost:${PORT}`
                    );


                const pathname =
                    requestURL.pathname;


                console.log(
                    `${request.method} ${pathname}`
                );


                /*
                 * Hospital API
                 */

                if (
                    pathname ===
                    "/api/hospitals"
                ) {

                    await handleHospitalAPI(
                        requestURL,
                        response
                    );

                    return;

                }


                /*
                 * Only GET/HEAD
                 */

                if (
                    request.method !== "GET" &&
                    request.method !== "HEAD"
                ) {

                    response.writeHead(
                        405,
                        {
                            "Content-Type":
                                "text/plain"
                        }
                    );


                    response.end(
                        "Method Not Allowed"
                    );


                    return;

                }


                /*
                 * Static files
                 */

                serveStaticFile(
                    pathname,
                    response
                );

            }

            catch (error) {

                console.error(
                    "Server Error:",
                    error
                );


                response.writeHead(
                    500,
                    {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                );


                response.end(
                    "Internal Server Error"
                );

            }

        }
    );


/* ==========================================
   START SERVER
========================================== */

server.listen(
    PORT,
    function() {

        console.log(
            "\n===================================="
        );

        console.log(
            "🏥 SMART HOSPITAL SERVER"
        );

        console.log(
            "===================================="
        );

        console.log(
            `🌐 Website: http://localhost:${PORT}`
        );

        console.log(
            `🏥 Hospital API: http://localhost:${PORT}/api/hospitals`
        );

        console.log(
            `📄 CSS: http://localhost:${PORT}/css/style.css`
        );

        console.log(
            `📜 JS: http://localhost:${PORT}/js/script.js`
        );

        console.log(
            "====================================\n"
        );

    }
);