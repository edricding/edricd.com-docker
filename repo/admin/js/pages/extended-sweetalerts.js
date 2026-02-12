document.getElementById("table-gridjs").addEventListener("click", function (e) {
  const deleteBtn = e.target.closest(".sweet-delete-btn");

  if (deleteBtn) {
    const id = deleteBtn.getAttribute("data-id");
    console.log("delete button clicked", id);

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: !0,
      customClass: {
        confirmButton: "btn btn-primary me-2 mt-2",
        cancelButton: "btn btn-danger mt-2",
      },
      confirmButtonText: "Yes, delete it!",
      buttonsStyling: !1,
      showCloseButton: !0,
    }).then(function (t) {
      t.value &&
        Swal.fire({
          title: "Deleted!",
          text: "Your file has been deleted.",
          icon: "success",
          customClass: { confirmButton: "btn btn-primary mt-2" },
          buttonsStyling: !1,
        });
    });
  }
});
