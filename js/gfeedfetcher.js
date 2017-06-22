        // -------------------------------------------------------------------
        // gAjax RSS Feeds Displayer- By Dynamic Drive, available at: http://www.dynamicdrive.com
        // Created: July 17th, 2007
        // Updated June 14th, 10': Fixed issue in IE where labels would sometimes be associated with the incorrect feed items
        // Updated May 24th, 12': Added onfeedload event handler to run code when a RSS displayer has fully loaded 2) Script now skips the loading of a RSS feed if it's invalid (instead of alert a message)
        // Updated Sept 20th, 12': Version 2. Adds support for templating of entries' output, search and replace via regular expressions inside any RSS field
        // Updated Dec 3rd, 16': Now uses YUI yql in place of Google Feeds API due to retirement of later. Also adds limitlength() method
        // Unofficial update Jan 23rd, '17(jscheuer1): Add and improve capability to process ATOM feeds, routines to complete main (title)) links
        // from feeds if they're relative, more options and tweak result of limitlength()*, add linktarget to all links in a feed/feed group,
        // distribute uneven filterfeed() 'number to show' more evenly, preserve for possible subsequent inits all regex's used on fields and
        // feed added via addregexp(), (previously only regex's used on the entire feed were preserved), add feedwritten function. add test to
        // see if target div already exists allowing the initial function to be recalled on the same element, tidy up code a bit
        // -------------------------------------------------------------------

        /* limitlength() still works mostly as originally designed. New options - even if the entry is already short enough, all tags
        can still be stripped from the field if a third parameter is set to true, ex:

        instance.limitlength(175, 'descriptionfield', true)

        Instead of providing a number limit, one can opt for the keyword 'strip'. If one does so, the
        result is that tags are stripped from the field but no limit is imposed, ex:

        instance.limitlength('strip', 'descriptionfield')

        Also, slightly changed is that the test to see if the limit is applied is now the on screen length of the unstripped text,
        rather than the unstripped length, which it did before and if done that way could sometimes result in shorter entries
        than desired, or unecessary stripping, HTML tags* add no length to text on the screen, but do add a lot to the string
        length. By removeing them and replacing non-breaking spaces with spaces, we can get a truer screen length of the text.

        * other than images, no way to measure them until they load. They can be set display none or sized in style,
          or strippred separately with regex feature.
        */

        var gfeedfetcher_loading_image="/img/loading.svg" //Full URL to "loading" image. No need to config after this line!!
        var gfeedfetcher_loading_image_percent="15" //Percent number to display loading image

        function gfeedfetcher(divid, divClass, linktarget){
            this.linktarget=linktarget || "" //link target of RSS entries
            this.feedlabels=[] //array holding lables for each RSS feed
            this.feedurls=[]
            this.feeds=[] //array holding combined RSS feeds' entries from Feed API (result.feed.entries)
            this.feedsfetched=0 //number of feeds fetched
            this.feedlimit=5
            this.showoptions="" //Optional components of RSS entry to show (none by default)
            this.outputtemplate="{title} {label} {date}<br />{description}" // output template for each RSS entry
            this.regexprules={} // object to hold regexp rules [regex, replacestr, field_to_apply_to]
            this.lengthlimits={} // object to hold length limits {field_to_apply_to: limit, etc}
            this.sortstring="date" //sort by "date" by default
            if(!document.getElementById(divid))
                document.write('<div id="'+divid+'" class="'+divClass+'"></div>') //output div to contain RSS entries
            this.feedcontainer=document.getElementById(divid)
            this.containertag=["li", "<li>"] // [tag to wrap around each rss entry, final tag]
            this.onfeedload=function(){}
            this.earlysister = gfeedfetcher.earlysister || gfeedfetcher.detectearlysister();
            this.feedtype = {}; // object to hold feedtypes
            this.feedwritten = function(){}; // execute just after feed written to page
        }

        gfeedfetcher.detectearlysister = function(){
            var es = typeof formatrssmessage === 'function' && !/ddpublishedDate/.test(formatrssmessage.toString());
            return gfeedfetcher.earlysister = es? true : 'no';
        }

        gfeedfetcher._formatdate=function(datestr, showoptions){
            var itemdate=new Date(datestr)
            var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            var parseddate=(showoptions.indexOf("datetime")!=-1)? itemdate.toLocaleString() : (showoptions.indexOf("date")!=-1)? itemdate.toLocaleDateString('en-US', options) : (showoptions.indexOf("time")!=-1)? itemdate.toLocaleTimeString() : ""
            return parseddate
        }

        gfeedfetcher.handleregexes = function(string, exps){
            if(!exps || !exps.length){return string;}
            var i = exps.length;
            while(--i > -1){
                string = string.replace(exps[i][0], exps[i][1]);
            }
            return string;
        }

        gfeedfetcher._outputre = /({title})|({url})|({label})|({date})|({description})/ig; // re used to follow template (do not edit)

        gfeedfetcher._baseurlre = /\/[^/]*$/;

        gfeedfetcher._sortarray=function(arr, sortstr){
            var sortstr=(sortstr=="label")? "ddlabel" : sortstr //change "label" string (if entered) to "ddlabel" instead, for internal use
            if (sortstr=="dditemtitle" || sortstr=="ddlabel"){ //sort array by "title" or "ddlabel" property of RSS feed entries[]
                arr.sort(function(a,b){
                var fielda=a[sortstr].toLowerCase();
                var fieldb=b[sortstr].toLowerCase();
                return (fielda<fieldb)? -1 : (fielda>fieldb)? 1 : 0
                })
            }
            else{ //else, sort by "ddpublishedDate" property (using error handling, as "ddpublishedDate" may not be a valid date str if an error has occured while getting feed
                try{
                    arr.sort(function(a,b){return new Date(b.ddpublishedDate)-new Date(a.ddpublishedDate)})
                }
                catch(err){}
            }
        };

        gfeedfetcher._blres = {web: /^http/, ext: /(htm|html|php|asp|jasp)(#|\?|$)/i, urn: /^urn:/i};

        gfeedfetcher.bestlink = function(entry){
            var links = [entry.id, entry.link && entry.link.href? entry.link.href : entry.link], i = links.length, lnk, res = gfeedfetcher._blres
            while(--i > -1){
                lnk = links[i];
                if(typeof lnk === 'string' && res.web.test(lnk) && res.ext.test(lnk)){return lnk;}
            } i = links.length;
            while(--i > -1){
                lnk = links[i];
                if(typeof lnk === 'string' && res.web.test(lnk)){return lnk;}
            } i = links.length;
            while(--i > -1){
                lnk = links[i];
                if(typeof lnk === 'string' && !res.urn.test(lnk) && res.ext.test(lnk)){return entry.ddbaseurl + lnk;}
            }
            return "javascript:void(0);";
        };

        gfeedfetcher.atomdesc = function(entry){
            var d = ['summary', 'content'], i = d.length, dsc;
            while(--i > -1){
                dsc = entry[d[i]];
                if(typeof dsc === 'string'){return dsc;}
                else if (dsc && typeof dsc.content === 'string'){return dsc.content;}
            } i = d.length
            while(--i > -1){
                if((dsc = gfeedfetcher.xml2txt(entry[d[i]]))){return dsc;}
            }
            return "";
        };

        gfeedfetcher.xml2txt = function(field, thefield){
            if(!!!field){return thefield || null;}
            if(typeof field === 'string'){return field;}
            if(typeof field.div === 'string'){return field.div;}
             /* begin experimental ATOM 'xhtml' object parser - used if no simple text/html seen in an ATOM title or description */
             /* if you want to skip this for all feeds, uncomment the following line */
            /* return ""; */
            var strs = [], re = thefield === 'title'? /content/i : /content|href/i; /* skip recursive links (if any) in title fileds */
            function iter(o){
                for(var p in o){
                    if(re.test(p) && typeof o[p] === 'string'){
                        strs.push(o[p])
                    } else if (typeof o[p] === 'object'){
                        iter(o[p]);
                    }
                }
            }
            if(field.div && field.type === 'xhtml'){
                iter(field.div);
                if(strs.length){return strs.join(' ');}
            }
            return thefield || null;    
        }; /* end experimental ATOM 'xhtml' object parser */

        gfeedfetcher.limitchars = function(thetext, limit){
            if (limit && typeof thetext == 'string'){
                var baretext = thetext.replace(/(&nbsp;|<([^>]+)>)/ig, '') // strip html tags: http://stackoverflow.com/questions/1499889/remove-html-tags-in-javascript-with-regex
                if(limit.limit === 'strip'){return baretext;}
                var screenlength = thetext.replace(/&nbsp;/ig, ' ').replace(/<([^>]+)>/ig, '').length;
                if (limit.limit && limit.limit < screenlength){
                    return baretext.substr(0, limit.limit) + '&#x2026;'
                } else if(limit.force === true){return baretext;}
            }
            return thetext;
        };

        gfeedfetcher._howmany = [].reduce? function(ar){return ar.reduce(function(t, n){return t + n;});}:function(ar){var i = ar.length, t = 0;while(--i > -1){t += ar[i];}return t;};

        gfeedfetcher._dist = function(srcs, tot){
            var i = srcs, t = 0;
            srcs = new Array(i);
            while(--i > -1){srcs[i] = 1;} i = srcs.length;
            do {
                while(--i > -1 && (t = gfeedfetcher._howmany(srcs)) < tot){++srcs[i];}
                i = srcs.length;
            }
            while (t < tot);
            return srcs.reverse();
        };

        gfeedfetcher.prototype = {

            addFeed: function(label, url, feedtype){
                this.feedlabels[this.feedlabels.length]=label
                this.feedurls[this.feedurls.length]=url
                if(typeof feedtype === 'string' && /rss|atom/i.test(feedtype)){
                    this.feedtype[url] = feedtype.toLowerCase();
                }
            },

            filterfeed: function(feedlimit, sortstr){
                this.feedlimit=feedlimit
                if (typeof sortstr === "string"){
                    this.sortstring=sortstr
                    if(sortstr.toLowerCase() === 'title')
                        this.sortstring='dditemtitle';
                }
            },

            displayoptions: function(parts){
                this.showoptions=parts //set RSS entry options to show ("date, datetime, time, label, description")
            },

            definetemplate: function(str){
                this.outputtemplate=str
            },

            addregexp: function(regliteral, replacewith, field){
                field = field || 'all';
                this.regexprules[field] = this.regexprules[field] || [];
                this.regexprules[field].push([regliteral, replacewith]);
            },

            limitlength: function(limit, field, force){
                if(typeof limit === 'string' && /^strip$/i.test(limit)){limit = 'strip';}
                this.lengthlimits[field] = {limit: limit, force: force === true? true : false};
            },

            setentrycontainer: function(containertag, cssclass){  //set element that should wrap around each RSS entry item
                this.containertag=[containertag.toLowerCase(), '<' + containertag.toLowerCase ()+ (cssclass? ' class="'+cssclass+'"' : '') + ' >']
            },

            init: function(){
                this.feedsfetched=0 //reset number of feeds fetched to 0 (in case init() is called more than once)
                this.feeds=[] //reset feeds[] array to empty (in case init() is called more than once)
                this.feedcontainer.innerHTML='<div class="col-lg-12 text-center"><img width="'+gfeedfetcher_loading_image_percent+'%" src="'+gfeedfetcher_loading_image+'" /><br><h4>Loading recent issues ...</h4></div>'
                var displayer = this, i = -1, numurls = this.feedurls.length, limit = this.feedlimit, rmain = limit%numurls;
                if(rmain > 0 && limit>numurls){var clim = gfeedfetcher._dist(numurls, limit);} //If feedlimit/feedurls.length yields a remainder, create distributive array
                else {var items_to_show=(limit<=numurls)? 1 : Math.floor(limit/numurls);} //Calculate # of entries to show for each RSS feed
                while (++i < numurls){ //loop through the specified RSS feeds' URLs
                    if (rmain>0 && limit>numurls) //If feedlimit/feedurls.length yields a remainder
                        var items_to_show = clim[i]; //use distributive array of items to show
                    ;(function(url, label, shownumber){
                        var feedtype = displayer.feedtype[url] || 'rss';
                        YUI().use('yql', function(Y){
                            var query = 'select * from ' + feedtype + '(0,' + shownumber +') where url = "' + url +'"'
                            var q = Y.YQL(query, function(r) {
                                //r now contains the result of the YQL Query
                                displayer._fetch_data_as_array(r, label, url.replace(gfeedfetcher._baseurlre, '/'))
                            })
                        })
                    })(this.feedurls[i], this.feedlabels[i], items_to_show) // capture proper url and label using closure
                }
            },

            _fetch_data_as_array: function(result, ddlabel, ddbaseurl){
                var query = result.query, i = -1, fl;
                var thisfeed=(query.count > 0)? query.results.item || query.results.entry  : "" //get all feed entries as a JSON array or "" if failed or empty
                if (thisfeed==""){ //if error has occured fetching feed
                    this._signaldownloadcomplete()
                    return
                }
                thisfeed = (thisfeed.length) ? thisfeed : [thisfeed] // if single entry, convert object to array
                fl = thisfeed.length;
                while (++i < fl){ //For each entry within feed
                    thisfeed[i].ddlabel=ddlabel //extend it with a "ddlabel" property
                    thisfeed[i].ddpublishedDate = thisfeed[i].published || thisfeed[i].pubDate || thisfeed[i].publishedDate || thisfeed[i].date || thisfeed[i].updated // try to locate date entry
                    this.earlysister === true && (function(){thisfeed[i].publishedDate = thisfeed[i].ddpublishedDate;})();
                    thisfeed[i].ddbaseurl = ddbaseurl;
                    thisfeed[i].dditemtitle = typeof thisfeed[i].title.content === 'string'? thisfeed[i].title.content : gfeedfetcher.xml2txt(thisfeed[i].title, 'title')
                }
                this.feeds=this.feeds.concat(thisfeed) //add entry to array holding all feed entries
                this._signaldownloadcomplete() //signal the retrieval of this feed as complete (and move on to next one if defined)
            },

            _signaldownloadcomplete: function(){
                this.feedsfetched+=1
                if (this.feedsfetched==this.feedurls.length){ //if all feeds fetched
                    this._displayresult(this.feeds) //display results
                    this.onfeedload()
                }
            },

            _displayresult: function(feeds){
                var thisinst = this, i = -1, fl = feeds.length;
                var rssoutput=(this.containertag[0]=="li")? "<ul>\n" : ""
                var itemurl=[], itemtitle=[], itemlabel=[], itemdate=[], itemdescription=[]
                gfeedfetcher._sortarray(feeds, this.sortstring)
                while (++i < fl){
                    itemurl.push(gfeedfetcher.bestlink(feeds[i]))
                    itemtitle.push(feeds[i].dditemtitle);
                    itemlabel.push(/label/i.test(this.showoptions)? this.feeds[i].ddlabel : "")
                    itemdate.push(gfeedfetcher._formatdate(feeds[i].ddpublishedDate, this.showoptions))
                    var itemdescriptionsingle=/description|snippet/i.test(this.showoptions)? feeds[i].description || gfeedfetcher.atomdesc(feeds[i]) || "" : "";
                    itemdescriptionsingle=(itemdescriptionsingle!="")? itemdescriptionsingle : ""
                    itemdescription.push(itemdescriptionsingle)
                }
                // create temp object to store references to rss components, for access dynamically:
                var holder={urlfield: itemurl, titlefield: itemtitle, labelfield: itemlabel, datefield: itemdate, descriptionfield: itemdescription}
                var regexprules = this.regexprules, targetarray, p;
                for(p in regexprules){
                    if((targetarray = holder[p])){
                        targetarray = targetarray.join('***delimiter***') // combine array elements before doing search and replace
                        holder[p] = gfeedfetcher.handleregexes(targetarray, regexprules[p]).split('***delimiter***'); // revert back to array
                    }
                }
                i = -1; fl = feeds.length;
                while (++i < fl){ // loop thru feeds, molding each feed entry based on template and character limit
                    rssoutput+= this.containertag[1] + this.outputtemplate.replace(gfeedfetcher._outputre, function(m){
                        if (m == "{title}"){
                            var title = gfeedfetcher.limitchars( holder.titlefield[i], thisinst.lengthlimits['titlefield'])
                            return '' + title + ''
                        }
                        else if (m == "{url}"){
                            return holder.urlfield[i]
                        }
                        else if (m == "{label}"){
                            return '<span class="labelfield">' + holder.labelfield[i] + '</span>\n'
                        }
                        else if (m == "{date}"){
                            return '' + holder.datefield[i] + ''
                        }
                        else if (m == "{description}"){
                            var desc = gfeedfetcher.limitchars( holder.descriptionfield[i], thisinst.lengthlimits['descriptionfield'])
                            return '<span class="descriptionfield">' + desc + '</span>\n'
                        }
                    }) + "</" + this.containertag[0] + ">" + "\n\n"
                }
                rssoutput+=(this.containertag[0]=="li")? "</ul>" : "";
                this.feedcontainer.innerHTML = gfeedfetcher.handleregexes(rssoutput, regexprules.all);
                if(this.linktarget){
                    var a = this.feedcontainer.getElementsByTagName('a'); i = a.length;
                    while (--i > -1){a[i].setAttribute('data-target', this.linktarget);}
                }
                this.feedwritten();
            }
        };