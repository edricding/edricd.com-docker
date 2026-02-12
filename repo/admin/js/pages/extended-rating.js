function onload(e) {
  raterJs({
    max: 5,
    rating: 4,
    element: document.querySelector("#rater2"),
    disableText: "Custom disable text!",
    ratingText: "My custom rating text {rating}",
    showToolTip: !0,
    rateCallback: function (e, t) {
      a.setRating(e), a.disable(), t();
    },
  });
}
window.addEventListener("load", onload, !1);
