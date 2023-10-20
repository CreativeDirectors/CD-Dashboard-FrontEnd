// @ts-nocheck
// import jsPDF from "jspdf";

// export function generateInvoice(e, element) {
//   const doc = new jsPDF({
//     format: "a4",
//     orientation: "portrait",
//     unit: "pt",
//   });

//   // get the html element from the dom
//   const pdfwrapper = document.querySelector("#pdf-wrapper");

//   // doc.text(singleOrder.name + singleOrder.renderPackage, 1, 1);
//   doc.html(pdfwrapper, {
//     callback: function (doc) {
//       doc.save();
//     },
//   });
//   // doc.save("two-by-four.pdf");
//   // doc.html(element.querySelector("[data-order-item='invoice-data']"), {
//   //   callback: function (doc) {
//   //     doc.save();
//   //   },
//   // });
// }

import html2pdf from "html2pdf.js";

export function generateInvoice(e, element) {
  const invoice = document.querySelector<HTMLElement>("#pdf-wrapper");
  const pdfwrapper = invoice.cloneNode(true);
  pdfwrapper.style.display = "block";

  let client = {};

  // get client data from user Settings Tab
  const clientElement = document.getElementById("user-data");

  if (clientElement)
    clientElement.querySelectorAll("[data-client]").forEach((e) => {
      client[e.getAttribute("data-client")] = e.innerHTML;
    });

  // this section replace the placeholders on the invoice with the actual data
  pdfwrapper.querySelectorAll("[data-invoice='client-name']").forEach((e) => {
    e.innerHTML = "test";
  });

  var opt = {
    // margin: 0,
    filename: "invoice.pdf",
    // image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      //   dpi: 192,
      //   letterRendering: true,
      width: 1050,
    },

    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  html2pdf().set(opt).from(pdfwrapper).save();
}
