var pagesManagerApp = angular.module('pagesManagerApp', ['ngFacebook', 'infinite-scroll', 'flow'])
    .config(function($facebookProvider) {
        $facebookProvider.setAppId('431565553673685');
        $facebookProvider.setCustomInit({
            xfbml: true,
            status: true
        });
        $facebookProvider.setPermissions("public_profile,manage_pages,read_insights,publish_actions");
        $facebookProvider.setVersion("v2.2");
    })
    .run(function($rootScope) {
        // Load the facebook SDK asynchronously
        (function() {
            // If we've already installed the SDK, we're done
            if (document.getElementById('facebook-jssdk')) {
                return;
            }

            // Get the first script element, which we'll use to find the parent node
            var firstScriptElement = document.getElementsByTagName('script')[0];

            // Create a new script element and set its id
            var facebookJS = document.createElement('script');
            facebookJS.id = 'facebook-jssdk';

            // Set the new script's source to the source of the Facebook JS SDK
            facebookJS.src = '//connect.facebook.net/en_US/all.js';

            // Insert the Facebook JS SDK into the DOM
            firstScriptElement.parentNode.insertBefore(facebookJS, firstScriptElement);

            setTimeout(function() {
                $('#page-loading').addClass('hidden');
                $('#wrapper').removeClass('hidden');
            }, 500);
        }());
    });

pagesManagerApp.controller('DashboardCtrl', function($scope, $facebook) {

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    var backdateDatePicker = $('#backdate-date-picker');
    backdateDatePicker.datetimepicker({
        minDate: hundredDaysAgo,
        maxDate: yesterday,
        format: 'MM/DD/YYYY'
    });

    var today = new Date();
    today.setMinutes(today.getMinutes() + 15);
    var sixMonthLater = new Date();
    sixMonthLater.setMonth(sixMonthLater.getMonth() + 6);
    var scheduleDatePicker = $('#schedule-date-picker');
    scheduleDatePicker.datetimepicker({
        minDate: today,
        maxDate: sixMonthLater
    });

    $scope.uploader = {};
    $scope.upload = function() {
        $scope.uploader.flow.upload();
    }

    $scope.loggedIn = false;

    $scope.$on('fb.auth.statusChange', function(event, response, FB) {
        cleanup();
        if (response.status === 'connected') {
            // Logged into your app and Facebook.
            $scope.loggedIn = true;
            buildMe();
        } else if (response.status === 'not_authorized') {
            // The person is logged into Facebook, but not your app.            
            $scope.loggedIn = false;
        } else {
            $scope.loggedIn = false;
            // The person is not logged into Facebook, so we're not sure if
            // they are logged into this app or not.
        }

    });

    $scope.previewUrl = function() {
        $scope.newpost.preview = null;
        $.embedly.extract($scope.newpost.link, {
                key: '8159df2f8bdc42c3993d69b15e50edeb'
            })
            .progress(function(data) {
                if (data.type != 'error') {
                    $scope.newpost.preview = data;
                }
            });
    }

    $scope.selectPage = function(index) {
        buildPage($scope.meAccounts[index]);
    }

    $scope.confirmDelete = function(pid) {
        $scope.toBeDeletePostId = pid;
        $('#confirm-delete-modal').modal('show');
    }

    $scope.confirmPublishNow = function(pid) {
        $scope.toBePublishPostId = pid;
        $('#confirm-publish-now-modal').modal('show');
    }

    $scope.deletePost = function() {
        toggleActions($scope.toBeDeletePostId);
        $('#confirm-delete-modal').modal('hide');
        if ($scope.toBeDeletePostId) {
            $facebook.api("/" + $scope.toBeDeletePostId, 'DELETE', {
                access_token: $scope.accessToken
            }).then(
                function(response) {
                    if (response.success) {
                        $scope.promotablePosts = $.grep($scope.promotablePosts, function(post) {
                            return post.id != $scope.toBeDeletePostId;
                        });

                    } else {
                        toggleActions($scope.toBeDeletePostId);
                    }
                    $scope.toBeDeletePostId = null;
                });
        }
    }

    $scope.publishPostNow = function() {

        toggleActions($scope.toBePublishPostId);

        $('#confirm-publish-now-modal').modal('hide');

        if ($scope.toBePublishPostId) {
            $facebook.api("/" + $scope.toBePublishPostId, 'POST', {
                access_token: $scope.accessToken,
                is_published: true
            }).then(
                function(response) {                    
                    if (response.success) {
                        $scope.promotablePosts = $.grep($scope.promotablePosts, function(post) {
                            return post.id != $scope.toBePublishPostId;
                        });

                        $facebook.api("/" + $scope.toBePublishPostId).then(function(response) {
                            if (response.id) {                                
                                response.post_impressions = 0;
                                response.post_engaged_users = 0;
                                response.is_published = true;
                                $scope.promotablePosts.splice(0, 0, response);
                            }
                        });
                    } else {
                        toggleActions($scope.toBePublishPostId);
                    }
                    $scope.toBePublishPostId = null;
                });
        }
    }

    resetNewPost();
    $scope.postNew = function() {
        $scope.newpost.isPublished = true;
        post();
    }

    $scope.postSchdule = function() {
        $scope.newpost.isPublished = false;
        post();
        $('#post-schedule-modal').modal('hide');
    }

    $scope.postDraft = function() {
        $scope.newpost.isPublished = false;
        post();
    }

    $scope.postBackdate = function() {
        $scope.newpost.isPublished = true;
        post();
        $('#post-backdate-modal').modal('hide');
    }

    $scope.showBackdateModal = function() {
        if (!$scope.newpost.message) {
            $('textarea').val('');
            postPostActions();
            $('textarea').focus();
        } else {
            $('#post-backdate-modal').modal('show');
        }
    }

    $scope.showScheduleModal = function() {
        if (!$scope.newpost.message) {
            $('textarea').val('');
            postPostActions();
            $('textarea').focus();
        } else {
            $('#post-schedule-modal').modal('show');
        }
    }

    $scope.loadMore = function() {
        if (!$scope.loadingPosts) {
            $scope.loadingPosts = true;
            if ($scope.loggedIn) {
                if (!$scope.promotablePosts) {
                    buildPageList();
                } else {
                    olderPosts();
                }
            }
        }
    }

    $scope.removeLinkPreview = function() {
        $scope.newpost.link = '';
        $scope.newpost.preview = null;
    }

    function olderPosts() {
        if ($scope.promotablePosts && $scope.promotablePostsPaging) {
            var nextUrl = $scope.promotablePostsPaging.next;
            if (nextUrl) {
                var params = getParams(nextUrl);
                buildPromotablePosts($scope.selectedPage.id, params);
            }
        }
    }

    function getParams(url) {
        var result = {};
        if (url) {
            var queryString = url.substring(url.indexOf('?') + 1);
            queryString.split("&").forEach(function(part) {
                var item = part.split("=");
                result[item[0]] = decodeURIComponent(item[1]);
            });
        }
        return result;
    }

    function handlePostError(error) {
        $('#failed-post-alert').text(error.error_user_msg ? error.error_user_msg : error.message).show();
        postPostActions();
    }

    function post() {
        var params = {
            access_token: $scope.accessToken
        };
        if ($scope.newpost.message) {
            params.message = $scope.newpost.message;
        }
        if ($scope.uploader.flow.files.length) {
            params.source = $scope.uploader.flow.files[0].file;
        }
        if ($scope.newpost.link) {
            params.link = $scope.newpost.link;
        }
        params.published = true;
        if (!$scope.newpost.isPublished) {
            params.published = false;
        }

        if ($('#schedule-date-picker input').val()) {
            var scheduleDatetime = moment($('#schedule-date-picker input').val(), 'MM/DD/YYYY h:mm a');
            if (scheduleDatetime) {
                params.scheduled_publish_time = scheduleDatetime.unix();
            }
        }
        if ($('#backdate-date-picker input').val()) {
            var backdateDatetime = moment($('#backdate-date-picker input').val(), 'MM/DD/YYYY');
            if (backdateDatetime) {
                params.backdated_time = backdateDatetime.unix();
            }
        }
        prePostActions();
        if (!$scope.newpost.message && !$scope.newpost.link && !$scope.newpost.source) {
            $('textarea').val('');
            postPostActions();
            $('textarea').focus();
        } else {
            console.log('Posting a schduled message to facebook.');
            if (params.source) {
                var uri = "https://graph.facebook.com/v2.2/" + $scope.selectedPage.id + "/photos";
                var xhr = new XMLHttpRequest();
                xhr.open("POST", uri, true);
                xhr.onreadystatechange = function() {

                    resetNewPost();
                    postPostActions();
                    if (xhr.readyState == 4 && xhr.status == 200) {
                        // Handle response.
                        if (xhr.responseText) {
                            var response = JSON.parse(xhr.responseText);
                            if (response.post_id || response.id) {
                                console.log('Posted successfully!');
                                var isPublished = $scope.newpost.isPublished;
                                resetNewPost();
                                var postId = response.post_id;
                                if (!postId) {
                                    postId = $scope.selectedPage.id + "_" + response.id;
                                }
                                $facebook.api("/" + postId).then(function(response) {
                                    if (response.id) {
                                        if (isPublished) {
                                            response.is_published = true;
                                        }
                                        response.post_impressions = 0;
                                        response.post_engaged_users = 0;
                                        $scope.promotablePosts.splice(0, 0, response);
                                    }
                                });
                            } else {
                                console.error("Failed to post photo to facebook.");
                                $('#failed-post-alert').text("Failed to post the photo. Please try again later.").show();
                            }
                        }
                    }
                };

                var fd = new FormData();
                if (params.message) {
                    fd.append('message', params.message);
                }
                if (params.scheduled_publish_time) {
                    fd.append('scheduled_publish_time', params.scheduled_publish_time);
                }
                if (params.backdated_time) {
                    fd.append('backdated_time', params.backdated_time);
                }
                fd.append('published', params.published);
                fd.append('access_token', params.access_token);
                fd.append('source', params.source);
                xhr.send(fd);

            } else {
                $facebook.api("/" + $scope.selectedPage.id + "/feed", 'POST', params).then(
                    function(response) {
                        if (response.id) {
                            console.log('Posted successfully!');
                            var isPublished = $scope.newpost.isPublished;
                            resetNewPost();
                            $facebook.api("/" + response.id).then(function(response) {
                                if (response.id) {
                                    if (isPublished) {
                                        response.is_published = true;
                                    }
                                    response.post_impressions = 0;
                                    response.post_engaged_users = 0;
                                    $scope.promotablePosts.splice(0, 0, response);
                                }
                            });
                        } else {
                            console.error("Failed to post message to facebook.");
                            $('#failed-post-alert').text("Failed to post the message. Please try again later.").show();
                        }
                        postPostActions();
                    }, handlePostError);
            }
        }
    }

    function resetNewPost() {
        var extra = $scope.newpost ? $scope.newpost.extra ? $scope.newpost.extra : 'status' : 'status';
        $scope.newpost = {
            'message': '',
            'extra': extra,
            'link': '',
            'isPublished': true
        };
        $('#schedule-date-picker input').val('');
        $('#backdate-date-picker input').val('');
    }

    function prePostActions() {
        $('#failed-post-alert').hide();
        $('.newpost-input').attr('disabled', true);
    }

    function postPostActions() {
        $scope.uploader.flow.cancel();
        $('.newpost-input').attr('disabled', false);
    }

    function toggleActions(pid) {
        if (pid) {
            $('.actions-' + pid).toggle();
            if ($('.post-progress-' + pid).hasClass('hidden')) {
                $('.post-progress-' + pid).removeClass("hidden");    
            } else {
                $('.post-progress-' + pid).addClass("hidden");
            }
            
        }
    }

    function buildMe() {
        $facebook.api("/me").then(
            function(response) {
                $scope.loggedIn = true;
                $scope.me = response;
            });
    }

    function buildPageList() {
        $facebook.api("/me/accounts?limit=50").then(
            function(response) {
                $scope.meAccounts = response.data;
                if ($scope.meAccounts.length > 0) {
                    buildPage($scope.meAccounts[0]);
                }
            });
    }

    function buildPage(page) {
        cleanup();
        $scope.accessToken = page.access_token;
        $facebook.api("/" + page.id, {
            access_token: page.access_token
        }).then(
            function(response) {
                $scope.selectedPage = response;
            });
        $facebook.api("/" + page.id + "/insights/page_impressions,page_engaged_users", {
            access_token: page.access_token
        }).then(function(response) {

            $scope.loadingPosts = true;
            var data = response.data;
            for (var i = 0; i < data.length; i++) {
                if (data[i].name == 'page_impressions' && data[i].period == 'days_28') {
                    $scope.page_impressions_28d = data[i].values[data[i].values.length - 1].value;
                } else if (data[i].name == 'page_engaged_users' && data[i].period == 'days_28') {
                    $scope.page_engaged_users_28d = data[i].values[data[i].values.length - 1].value;
                }
            }
            buildPromotablePosts(page.id, {
                access_token: $scope.accessToken
            });

        });

    }

    function buildPromotablePosts(pagId, params) {
        $facebook.api("/" + pagId + "/promotable_posts", params).then(function(response) {
            var postsResponseData = response.data;
            if (!$scope.promotablePosts) {
                $scope.promotablePosts = postsResponseData;
            } else {
                $scope.promotablePosts.push.apply($scope.promotablePosts, postsResponseData);
            }
            if (postsResponseData.length > 0) {
                $scope.promotablePostsPaging = response.paging;
                var batch = [];
                for (var i = 0; i < postsResponseData.length; i++) {
                    batch.push({
                        method: 'GET',
                        relative_url: '/' + postsResponseData[i].id + '/insights/post_impressions,post_engaged_users?include_headers=false'
                    });
                }
                $scope.loadingPosts = false;
                $facebook.api("/", "POST", {
                    access_token: $scope.accessToken,
                    batch: batch
                }).then(function(response) {
                    if (response.length != postsResponseData.length) {
                        console.log("Insights length is different than the posts.");
                    } else {
                        console.log("Start process insights for " + response.length + " posts");
                        var len = $scope.promotablePosts.length;
                        var pos = 1;
                        for (var i = response.length - 1; i >= 0; i--) {
                            if (response[i].code == 200) {
                                var body = JSON.parse(response[i].body);
                                $scope.promotablePosts[len - pos].post_impressions = body.data[0].values[0].value;
                                $scope.promotablePosts[len - pos++].post_engaged_users = body.data[1].values[0].value;
                            }
                        }
                    }
                });
            } else {
                $scope.hasMorePosts = false;
            }
        });
    }

    function showPostsLoading() {
        $('.posts-loading').show();
        $('.posts').hide();
    }

    function hidePostsLoading() {
        $('.posts-loading').hide();
        $('.posts').show();
    }

    function cleanup() {
        $scope.selectedPage = null;
        $scope.promotablePosts = null;
        $scope.loadingPosts = false;
        $scope.hasMorePosts = true;
    }
});