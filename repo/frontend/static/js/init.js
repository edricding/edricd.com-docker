/*
 * Copyright (c) 2026 Edric Ding
 */

(function ($) {
  "use strict";

  var Rewall = {
    root: $(":root"),

    /* collect all functions for next initialization */
    init: function () {
      /* Set background image from data attribute */
      Rewall.BgImg();

      /* Change image into SVG */
      Rewall.imgToSVG();

      /* Navigation Resize */
      Rewall.navigation__resize();

      /* Navigation Closer */
      Rewall.navigation__closer();

      /* Smooth Scroll to next section */
      Rewall.scrollToNextSection();

      /* Parallax Effect for about shortcode */
      Rewall.about__parallax();

      /* Parallax Effect for about shortcode */
      Rewall.tabs();

      /* Progress Bar */
      Rewall.progress();

      /* Isotope Masonry */
      Rewall.isotope();

      /* Owl Carousel for Testimonials */
      Rewall.testimonial();

      /* Load More photos in Gallery List */
      Rewall.loadGalleryPhotos();

      /* Contact Form */
      Rewall.contactForm();

      /* Moving Placeholder for Contact Form */
      Rewall.movingPlaceholder();

      /* cv button hover */
      Rewall.cvHover();

      /* magnific popup */
      Rewall.magnific();

      /* wow effect for the whole site */
      Rewall.wow();

      /* scroll to anchor */
      Rewall.scrollToAnchor();

      /* color sceme */
      Rewall.colorScheme();

      /* mobile menu opener with hamburger */
      Rewall.mobileMenuOpener();
    },

    mobileMenuOpener: function () {
      var hamburger = $(".rewall_fn_mobilemenu_wrap .hamburger");
      hamburger.on("click", function () {
        var element = $(this);
        var menupart = $(".rewall_fn_mobilemenu_wrap .mobilemenu");
        if (element.hasClass("is-active")) {
          element.removeClass("is-active");
          menupart.removeClass("opened");
          menupart.slideUp(500);
        } else {
          element.addClass("is-active");
          menupart.addClass("opened");
          menupart.slideDown(500);
        }
        return false;
      });
    },

    colorScheme: function () {
      var scheme = $(".rewall_fn_color_scheme"); // color scheme
      var items = scheme.find(".item"); // all website items
      var perpage = 3; // perpage
      var count = items.length; // website items count
      var page = 1; // active page number
      var max = Math.ceil(count / perpage); // total page number
      var button = scheme.find("[data-color]"); // all colors buttons
      var opener = scheme.find(".opener"); // opener
      var mainColor = "--main-color"; //
      var textColor = "--text-color-for-main-bg"; //
      var activeColor = Rewall.root.css(mainColor).replace(/\s+/g, ""); // detect main color to change it in next functions

      // set all colors as background
      button.each(function () {
        $(this).css({ backgroundColor: $(this).attr("data-color") });
      });

      // set current pagination
      scheme.find(".current").text(page);
      scheme.find(".separator").text("/");
      scheme.find(".total").text(max);

      // disable all items since perpage+1 child
      items
        .eq(perpage - 1)
        .nextAll()
        .addClass("disabled");

      // pagination
      scheme
        .find(".my__nav a")
        .off()
        .on("click", function () {
          var element = $(this);
          if (element.hasClass("next")) {
            page = page === max ? 1 : page + 1;
          } else {
            page = page === 1 ? max : page - 1;
          }
          items.addClass("disabled");
          for (var i = 0; i < perpage; i++) {
            items.eq((page - 1) * perpage + i).removeClass("disabled");
          }
          scheme.find(".current").text(page);
          return false;
        });

      // select color
      button.on("click", function () {
        var element = $(this);
        var color = element.attr("data-color").replace(/\s+/g, "");
        if (!element.hasClass("active")) {
          if (color !== "" && color !== "#") {
            button.removeClass("active");
            element.addClass("active");
            Rewall.root.css(mainColor, color);
            activeColor = color;
            Rewall.setTextColor(color, textColor);
          }
        }
        return false;
      });

      var time = null;
      opener
        .off()
        .on("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          scheme.addClass("opened");
          return false;
        })
        .on("mouseenter", function () {
          return false;
          var i = 0;
          time = setInterval(function () {
            var color = button.eq(i).attr("data-color").replace(/\s+/g, "");
            opener.css({ backgroundColor: color });
            Rewall.root.css(mainColor, color);
            Rewall.setTextColor(color, textColor);
            i++;
          }, 200);
        })
        .on("mouseleave", function () {
          return false;
          clearInterval(time);
          opener.css({ backgroundColor: "var(" + mainColor + ")" });
          Rewall.root.css(mainColor, activeColor);
          Rewall.setTextColor(activeColor, textColor);
        });
      scheme
        .find(".closer")
        .off()
        .on("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          scheme.removeClass("opened");
          return false;
        });
      scheme.find(".color_box").on("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
      $("body").on("click", function () {
        scheme.removeClass("opened");
      });
    },

    setTextColor: function (color, textColor) {
      if (Rewall.returnLuma(color) < 60) {
        Rewall.root.css(textColor, "#fff");
      } else {
        Rewall.root.css(textColor, "#000");
      }
    },

    returnLuma: function (hex) {
      var c = hex.substring(1); // strip #
      var rgb = parseInt(c, 16); // convert rrggbb to decimal
      var r = (rgb >> 16) & 0xff; // extract red
      var g = (rgb >> 8) & 0xff; // extract green
      var b = (rgb >> 0) & 0xff; // extract blue
      var luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
      return luma;
    },

    scrollToAnchor: function () {
      $(".main_button a").on("click", function () {
        var element = $(this);
        if ($(element.attr("href")).length) {
          $("html, body").animate(
            { scrollTop: $(element.attr("href")).offset().top },
            1000,
          );
        }
      });
    },

    wow: function () {
      new WOW({
        callback: function (box) {
          $(box).addClass("done");
        },
      }).init();
    },

    // magnific: function () {
    //   $(".gallery_zoom").each(function () {
    //     // the containers for all your galleries
    //     var zoom = $(this);
    //     // var galleryItems 	= Rewall.magnificItems(zoom);
    //     // zoom.magnificPopup({
    //     // 	gallery: {
    //     // 	  enabled: true
    //     // 	},
    //     // 	removalDelay: 300,
    //     // 	mainClass: 'mfp-fade',
    //     // 	items: galleryItems,
    //     // });

    //     zoom.magnificPopup({
    //       delegate: "a.zoom", // 关键：绑定到每一个缩略图链接
    //       type: "image",
    //       gallery: { enabled: true },
    //       removalDelay: 300,
    //       mainClass: "mfp-fade",
    //       image: {
    //         titleSrc: function (item) {
    //           // 让标题继续用 data-title
    //           return item.el.attr("data-title") || "";
    //         },
    //       },
    //     });
    //   });
    // },
    magnific: function () {
      $(".gallery_zoom").each(function () {
        var zoom = $(this);

        // 生成去重后的 gallery items（按 src + title 去重）
        var galleryItems = Rewall.magnificItems(zoom);

        // 防止重复绑定
        zoom.off("click.mfp").on("click.mfp", "a.zoom", function (e) {
          e.preventDefault();

          var src = $(this).attr("href");
          var title = $(this).attr("data-title") || "";

          // 在去重数组里找 index
          var idx = galleryItems.findIndex(function (it) {
            return it.src === src && (it.title || "") === title;
          });

          // 如果因为 title 不一致没找到，就只用 src 再找一次（更鲁棒）
          if (idx < 0) {
            idx = galleryItems.findIndex(function (it) {
              return it.src === src;
            });
          }

          $.magnificPopup.open(
            {
              items: galleryItems,
              gallery: { enabled: true },
              removalDelay: 300,
              mainClass: "mfp-fade",
            },
            idx >= 0 ? idx : 0,
          );
        });
      });
    },

    magnificItems: function (zoom) {
      var GalleryItems = [];
      zoom.find(".zoom").each(function () {
        var element = $(this),
          src = element.attr("href"),
          title = element.attr("data-title");

        if (!title || typeof title === "undefined") {
          title = "";
        }

        var collection = {
          src: src,
          type: "image",
          title: title,
        };
        GalleryItems.push(collection);
      });

      GalleryItems = GalleryItems.reduce(function (previous, current) {
        var object = previous.filter(
          (object) =>
            object.src === current.src && object.title === current.title,
        );
        if (object.length === 0) {
          previous.push(current);
        }
        return previous;
      }, []);

      return GalleryItems;
    },

    cvHover: function () {
      $(".fn_cs_cv_btn a")
        .on("mouseenter", function () {
          $(this).closest(".fn_cs_cv_btn").addClass("hovered");
        })
        .on("mouseleave", function () {
          $(this).closest(".fn_cs_cv_btn").removeClass("hovered");
        });
    },

    movingPlaceholder: function () {
      $(".rewall_fn_contact .input_wrapper").each(function () {
        var e = $(this);
        var input = e.find("input, textarea");
        if (input.val() === "") {
          e.removeClass("active");
        }
        input
          .on("focus", function () {
            e.addClass("active");
          })
          .on("blur", function () {
            if (input.val() === "") {
              e.removeClass("active");
            }
          });
      });
    },

    contactForm: function () {
      function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
      }

      $("#send_message")
        .off("click")
        .on("click", function () {
          var form = $(".rewall_fn_contact .contact_form");
          var name = $.trim($("#name").val());
          var email = $.trim($("#email").val());
          var message = $.trim($("#message").val());
          var phone = $.trim($("#phone").val()); // optional
          var spanSuccess = form.find(".success");
          var success = spanSuccess.data("success");

          // 清空后端返回提示
          spanSuccess.empty();

          // 先收起提示（避免叠加）
          $(".empty_notice").stop(true, true).hide();
          $(".email_wrong_notice").stop(true, true).hide();

          // 必填校验：name/email/message
          if (name === "" || email === "" || message === "") {
            $(".empty_notice")
              .stop(true, true)
              .slideDown(500)
              .delay(2000)
              .slideUp(500);
            return false;
          }

          // email 格式校验
          if (!isValidEmail(email)) {
            $(".email_wrong_notice")
              .stop(true, true)
              .slideDown(500)
              .delay(2000)
              .slideUp(500);
            return false;
          }

          // 提交（不再传 emailto）
          $.post(
            "modal/contact.php",
            {
              ajax_name: name,
              ajax_email: email,
              ajax_message: message,
              ajax_phone: phone,
            },
            function (data) {
              spanSuccess.append(data);

              if (spanSuccess.find(".contact_error").length) {
                spanSuccess.slideDown(500).delay(2000).slideUp(500);
              } else {
                spanSuccess.append(
                  "<span class='contact_success'>" + success + "</span>",
                );
                spanSuccess.slideDown(500).delay(4000).slideUp(500);
              }

              if (data === "") {
                form[0].reset();
              }
            },
          );

          return false;
        });
    },

    loadGalleryPhotos: function () {
      $(".gallery_list .load_more a")
        .on("mousedown", function () {
          var element = $(this);
          var text = element.find(".text");
          // stop function if don't have more items
          if (element.hasClass("done")) {
            element.addClass("hold");
            text.text(element.attr("data-no"));
            return false;
          }
        })
        .on("mouseup", function () {
          var element = $(this);
          var text = element.find(".text");
          // stop function if don't have more items
          if (element.hasClass("done")) {
            element.removeClass("hold");
            text.text(element.attr("data-done"));
            return false;
          }
        })
        .on("mouseleave", function () {
          var element = $(this);
          var text = element.find(".text");
          // stop function if don't have more items
          if (element.hasClass("done")) {
            element.removeClass("hold");
            text.text(element.attr("data-done"));
            return false;
          }
        });
      $(".gallery_list .load_more a").on("click", function () {
        var element = $(this);
        var text = element.find(".text");

        // stop function if elements are loading right now
        if (element.hasClass("loading") || element.hasClass("done")) {
          return false;
        }
        element.addClass("loading");

        var time = null;
        var loadingText = element.attr("data-loading");
        var array = loadingText.split("");
        var newText = "";
        var count = array.length;
        var speed = 1000 / count;
        for (var i = 0; i < count; i++) {
          newText += array[i];
          Rewall.search_placeholder(text, newText, i, speed);
        }

        time = setInterval(function () {
          newText = "";
          for (var i = 0; i < count; i++) {
            newText += array[i];
            Rewall.search_placeholder(text, newText, i, speed);
          }
        }, speed * count);

        setTimeout(
          function () {
            clearInterval(time);
            element.removeClass("loading");
          },
          speed * count * 1.9,
        );

        setTimeout(
          function () {
            var listItem = element
              .closest(".gallery_list")
              .find(".be_animated");
            listItem.each(function (i, e) {
              setTimeout(function () {
                $(e).addClass("fadeInTop done");
              }, i * 100);
            });
            element.addClass("done");
            text.text(element.attr("data-done"));
          },
          speed * count * 2,
        );

        return false;
      });
    },

    search_placeholder: function (text, newText, i, speed) {
      setTimeout(function () {
        text.text(newText);
      }, i * speed);
    },

    testimonial: function () {
      var owl = $(".fn_cs_testimonials .owl-carousel");
      owl.each(function () {
        var el = $(this);
        var parent = el.closest(".fn_cs_testimonials");
        el.owlCarousel({
          autoplay: true,
          autoplayTimeout: 7000,
          smartSpeed: 1000,
          loop: true,
          margin: 10,
          nav: false,
          items: 1,
          dots: false,
        });
        el.trigger("refresh.owl.carousel");
        el.on("changed.owl.carousel", function () {
          el.trigger("stop.owl.autoplay");
          el.trigger("play.owl.autoplay");
        });
        var prev = parent.find(".my__nav .prev");
        var next = parent.find(".my__nav .next");
        prev.off().on("click", function () {
          el.trigger("prev.owl");
          return false;
        });
        next.off().on("click", function () {
          el.trigger("next.owl");
          return false;
        });
      });
      Rewall.imgToSVG();
      Rewall.BgImg();
    },

    isotope: function () {
      var masonry = $(".fn__masonry");
      if ($().isotope) {
        masonry.each(function () {
          $(this).isotope({
            itemSelector: ".masonry_in",
            masonry: {},
          });
        });
      }
    },

    progress: function () {
      $(".fn_cs_progress_bar").each(function () {
        var pWrap = $(this);
        pWrap.waypoint({
          handler: function () {
            Rewall.progressF(pWrap);
          },
          offset: "90%",
        });
      });
    },

    progressF: function (container) {
      container.find(".progress_item").each(function (i) {
        var progress = $(this);
        var pValue = parseInt(progress.data("value"));
        var percent = progress.find(".progress_percent");
        var pBar = progress.find(".progress_bg");
        pBar.css({ width: pValue + "%" });
        setTimeout(function () {
          progress.addClass("open");
          percent.html(pValue + "%").css({ right: 100 - pValue + "%" });
        }, i * 500);
      });
    },

    recallProgress: function (tabs) {
      tabs.find(".progress_bg").css({ width: "0%" });
      tabs.find(".progress_percent").html("").css({ right: "100%" });
      tabs.find(".progress_item").removeClass("open");
      Rewall.progress();
    },

    tabs: function () {
      $(".fn_cs_tabs .tab_header a")
        .off()
        .on("click", function () {
          var e = $(this);
          var li = e.parent();
          var tabs = e.closest(".fn_cs_tabs");
          if (li.hasClass("active")) {
            return false;
          } else {
            li.siblings().removeClass("active");
            tabs.find(".tab_content").children().removeClass("active");
            li.addClass("active");
            $(e.attr("href")).addClass("active");
            Rewall.recallProgress(tabs);
          }

          return false;
        });
    },

    about__parallax: function () {
      $("#scene").parallax();
    },

    scrollToNextSection: function () {
      var DELAY = 300,
        clicks = 0,
        timer = null,
        arrowAnimationTime = 300,
        scrollAnimationTime = 700;

      $(".fn__next_section a")
        .on("click", function () {
          var btn = $(this);
          var section = btn.closest(".fn__next_section");
          var topOffset = 0;
          clicks++; //count clicks

          if (clicks === 1) {
            timer = setTimeout(function () {
              topOffset = section.next().offset().top;
              $("html, body").animate(
                { scrollTop: topOffset - 40 },
                scrollAnimationTime,
              );
              clicks = 0; //after action performed, reset counter
            }, DELAY);
            return false;
          } else {
            clearTimeout(timer); //prevent single-click action

            section.addClass("reverse");

            setTimeout(function () {
              section.removeClass("reverse");
            }, scrollAnimationTime + arrowAnimationTime);

            setTimeout(function () {
              topOffset = section.prev().offset().top;
              $("html, body").animate(
                { scrollTop: topOffset - 40 },
                scrollAnimationTime,
              );
            }, arrowAnimationTime);

            clicks = 0; //after action performed, reset counter
            return false;
          }
        })
        .on("dblclick", function (e) {
          e.preventDefault(); //cancel system double-click event
        });
    },

    navigation__closer: function () {
      var wrapper = $(".rewall_fn_wrapper_all");
      $(".rewall_fn_sidebar .nav__button")
        .off()
        .on("click", function () {
          if (wrapper.hasClass("sidebar-closed")) {
            wrapper.removeClass("sidebar-closed");
          } else {
            wrapper.addClass("sidebar-closed");
          }
          setTimeout(function () {
            Rewall.isotope();
            Rewall.testimonial();
          }, 500);

          return false;
        });
    },

    navigation__resize: function () {
      var isResizing = false,
        lastDownX = 0;

      var sidebar = $(".rewall_fn_sidebar"),
        content = $(".rewall_fn_content"),
        handle = sidebar.find(".nav_line"),
        max = sidebar.data("max"),
        min = sidebar.data("min"),
        body = $("body"),
        indicator = sidebar.find(".width_indicator");

      handle.on("mousedown", function (e) {
        isResizing = true;
        lastDownX = e.clientX;
        body.addClass("sidebar-resize");
      });

      $(document)
        .on("mousemove", function (e) {
          // we don't want to do anything if we aren't resizing.
          var lastDownX = e.clientX;
          if (!isResizing || lastDownX > max || lastDownX < min) {
            return;
          }

          sidebar.css("width", lastDownX);
          content.css("padding-left", lastDownX);
          indicator.html(lastDownX + "px");
        })
        .on("mouseup", function () {
          // stop resizing
          isResizing = false;
          body.removeClass("sidebar-resize");
          Rewall.testimonial();
          Rewall.isotope();
        });
    },

    imgToSVG: function () {
      $("img.fn__svg").each(function () {
        var img = $(this);
        var imgClass = img.attr("class");
        var imgURL = img.attr("src");

        $.get(
          imgURL,
          function (data) {
            var svg = $(data).find("svg");
            if (typeof imgClass !== "undefined") {
              svg = svg.attr("class", imgClass + " replaced-svg");
            }
            img.replaceWith(svg);
          },
          "xml",
        );
      });
    },

    BgImg: function () {
      var div = $("*[data-bg-img]");
      div.each(function () {
        var element = $(this);
        var attrBg = element.attr("data-bg-img");
        if (typeof attrBg !== "undefined") {
          element.css({ backgroundImage: "url(" + attrBg + ")" });
        }
      });
      var div2 = $("*[data-fn-bg-img]");
      div2.each(function () {
        var element = $(this);
        var attrBg = element.attr("data-fn-bg-img");
        if (typeof attrBg !== "undefined") {
          element.css({ backgroundImage: "url(" + attrBg + ")" });
        }
      });
    },
  };

  // READY Functions
  $(document).ready(function () {
    Rewall.init();
  });

  // RESIZE Functions
  $(window).on("resize", function () {
    Rewall.isotope();
  });

  // LOAD Functions
  $(window).on("load", function () {
    setTimeout(function () {
      Rewall.isotope();
    }, 10);
  });

  // SCROLL Functions
  $(window).on("scroll", function () {});
})(jQuery);

jQuery(".anchor_nav").onePageNav();
