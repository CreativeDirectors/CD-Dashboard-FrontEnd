// @ts-nocheck
import { greetUser } from "$utils/greet";
import jsPDF from "jspdf";
import {
  uploader,
  checkFolderExistence,
  getFolderList,
  getBatchThumbnails,
  downloadDropboxItem,
  uploadToDropbox,
} from "$utils/dropBoxFn";

import {
  getOrderFilesPaths,
  downloadJsonData,
  getThumbnailData,
  checkUserFolder,
} from "$utils/dataHandlers";

import { generateInvoice } from "$utils/invoiceGenerator";
import { saveInputToLocalHost } from "$utils/placeholderFormContent";

import axios from "axios";
import cookie from "cookie";

window.Webflow ||= [];
window.Webflow.push(() => {
  greetUser("hello from local");
  const orderTemplate = {
    order: {
      type: "",
      name: "",
      dimensions: {
        width: "",
        height: "",
        length: "",
      },
      specialFunction: "",
      specialFunctionScene: false,
      material: "",
      color: "",
      images: [],
      extras: {
        viewangles: "",
        lightPreferences: "",
        roomType: "",
      },
      renderPackage: "",
      roomTypeDescription: "",
      metadata: {},
    },
  };
  /**
   * a single order template that resets after each call
   * to reset it :
   *   singleOrder = JSON.parse(JSON.stringify(orderTemplate));
   *  instead of : singleOrder = orderTemplate
   *  to seperate memory allocations
   */
  let singleOrder = JSON.parse(JSON.stringify(orderTemplate));

  const userOrders = [];

  const GetCurrentUserEmail = () => {
    let cookies = cookie.parse(document.cookie);
    return cookies.email;
  };

  async function init() {
    const email = document.getElementById("wf-user-account-email");
    // const form = document.getElementById("email-form");
    const form = document.getElementById("wf-form-render-submission");
    const imageInputField = document.getElementById("imgsupload");
    const output = document.getElementById("output");
    const testbtn = document.getElementById("test-folder-content");

    /*** ELEMENT COMPONENET */

    const ordersWrapper = document.querySelector("[data-orders-wrapper]");
    const template = document.querySelector("[data-order-element]");

    const thumbnailContainer = document.querySelector(
      "[data-thumbnails-container]"
    );
    const thumbnailSlot = document.querySelector("[data-thumbnails-slot]");

    if (!template && !ordersWrapper) return;

    //CloneItem
    //const item = cloneNode(itemTemplate)

    /** */

    //get user from Cookie
    const CurrentUserEmail = GetCurrentUserEmail();
    // [0].entries[0].path_display

    let accessKey = "";
    //   /CD-uploads/user@email.com
    let userFolderStructure: string[] = [];
    // /CD-uploads/user@email.com/xx-xx-xx--xx:xx:xx
    let userVersionedUploads = [];

    /**
     * testing button eventlistener
     */
    // testbtn?.addEventListener("click", async function (e) {
    //   e.preventDefault();
    //   try {
    //     userVersionedUploads.map(async (e) => {
    //       const res = await getBatchThumbnails(e);
    //     });
    //   } catch (error) {
    //     console.log("error in test 2", error);
    //   }
    // });

    /**
     * *create view elements from template and serverUserData
     *
     * !VIEW UPDATA
     */
    function updateView(userData, templateElement) {
      const ordersWrapper = templateElement.parentElement!;

      templateElement.remove();

      //remove lottie
      const lottie = document.querySelector("#orders-loading-lottie");
      if (lottie) lottie.remove();

      const orderItems = userData.map((e, index) => {
        const elem = template?.cloneNode(true);
        elem.style.display = "flex";

        const nameElement = elem.querySelector("[data-order-item='ph-name']");
        const thumbnails = elem.querySelector("[data-order-item='thumbnails']");
        const description = elem.querySelector(
          "[data-order-item='ph-description']"
        );

        //name
        if (nameElement && e != undefined) {
          nameElement.innerText = e.name || "NO_NAME";
        }

        //description
        if (description && e != undefined) {
          description.innerText =
            `${e.type} ${
              e.specialFunction ? " with " + e.specialFunction : ""
            } - ${e.material} - ${e.dimensions.width}mm x ${
              e.dimensions.height
            }mm x ${e.dimensions.length}mm : ${e.renderPackage}` ||
            "NO_DESCRIPTION";
        }

        //thumbnails
        if (thumbnails) {
          const thumbnailswrapper = thumbnails.parentElement!;
          let images = "";
          e.images.map((i) => {
            images += `<div class="upload-queue-images">
              <img src="${i.thumbnail}" alt="image">
            </div>`;
            //!trying to Fix lightbox issue

            // images += `<a href="https://picsum.photos/200/300" data-lightbox="roadtrip" alt="image"> image </a>`;
          });
          thumbnails.innerHTML = images;
        }

        // Componants Animation :

        const btnOrder = elem.querySelector("#btn-details");
        const lightboxWrapper = btnOrder.querySelector(
          ".order-lightbox-wrapper"
        );
        const lightbox = btnOrder.querySelector(".order-lightbox");
        const detail_close = btnOrder.querySelector(".detail-close");

        btnOrder.addEventListener("click", () => {
          lightboxWrapper.style.display = "flex";
          lightbox.style.opacity = "100%";
          detail_close.style.opacity = "100%";
          lightbox.style.transform = "translateY(-10vh)";
        });

        document.body.addEventListener("click", (event) => {
          if (
            !lightbox.contains(event.target) &&
            // event.target !== detail_close &&
            event.target !== btnOrder
          ) {
            lightboxWrapper.style.display = "none";
            lightbox.style.opacity = "0";
            detail_close.style.opacity = "0";
          }
        });

        // end animation

        //main thumbnail
        const mainThumb = elem.querySelector("[data-order-item='ph-main-img']");
        if (mainThumb && e.images[0] != undefined) {
          if (mainThumb.hasAttribute("srcset"))
            mainThumb.removeAttribute("srcset");
          mainThumb.src = e.images[0].thumbnail;
        }
        //end main thumbnail

        //order details
        //name
        const orderName = elem.querySelector("[data-order-item='name']");
        if (orderName) {
          orderName.innerText = e.name || "NO_NAME";
        }
        //dimensions
        const orderDimensions = elem.querySelector(
          "[data-order-item='dimensions']"
        );
        if (orderDimensions) {
          orderDimensions.innerText = `${e.dimensions.width}mm x ${e.dimensions.height}mm x ${e.dimensions.length}mm`;
        }
        //material
        const orderMaterial = elem.querySelector(
          "[data-order-item='material']"
        );
        if (orderMaterial) {
          orderMaterial.innerText = getOnMaterials(e.metadata);
        }
        //category
        const orderCategory = elem.querySelector(
          "[data-order-item='category']"
        );
        if (orderCategory) {
          orderCategory.innerText = e.type;
        }

        //finish
        const orderFinish = elem.querySelector(
          "[data-order-item='color-finish']"
        );
        if (orderFinish) {
          orderFinish.innerText = e.material;
        }
        //special function
        const orderSpecialFunction = elem.querySelector(
          "[data-order-item='special-functions']"
        );
        if (orderSpecialFunction) {
          orderSpecialFunction.innerText = e.specialFunction || "No";
        }
        //special function scene
        const orderSpecialFunctionScene = elem.querySelector(
          "[data-order-item='special-functions-scene']"
        );
        if (orderSpecialFunctionScene) {
          orderSpecialFunctionScene.innerText = e.specialFunctionScene
            ? "Yes"
            : "No";
        }
        //view angles
        const orderViewAngles = elem.querySelector(
          "[data-order-item='extra-view-angles']"
        );
        if (orderViewAngles) {
          orderViewAngles.innerText = e.extras.viewangles;
        }
        //light preferences
        const orderLightPreferences = elem.querySelector(
          "[data-order-item='light']"
        );
        if (orderLightPreferences) {
          orderLightPreferences.innerText = e.extras.lightPreferences;
        }
        //room type
        const orderRoomType = elem.querySelector(
          "[data-order-item='room-type']"
        );
        if (orderRoomType) {
          orderRoomType.innerText = e.extras.roomType;
        }
        //render package
        //! needs to be changed
        const selectedRenderPackage = e.renderPackage;
        var number = selectedRenderPackage.match(/\d+/);

        const orderRenderPackage = elem.querySelector(
          `#details-package-${number}`
        );

        if (orderRenderPackage) {
          orderRenderPackage.style.display = "block";

          // orderRenderPackage.innerText = e.renderPackage;
        }

        //end order details

        // generateInvoice(e, elem);
        // Add a click event listener to the button
        //         elem.querySelector("[data-order-item='invoice-data']").innerHTML = `
        //   <div class="invoice-wrapper" style="font-size: 16px;">
        //     <div class="invoice-header">
        //       <div class="invoice-header__logo">
        //         <img
        //           src="https://uploads-ssl.webflow.com/60b9b8f0a5b2f1b3a8b2c7a5/60b9b8f0a5b2f1b3a8b2c7c2_logo.svg"
        //           alt="logo"
        //         />
        //       </div>
        //       <div class="invoice-header__title" style="font-size: 24px;">
        //         <h1>Invoice</h1>
        //       </div>
        //     </div>

        //     <div class="invoice-content">
        //       <div class="invoice-content__left">
        //         <div class="invoice-content__left__customer">
        //           <h3 style="font-size: 18px;">Customer</h3>
        //           <p style="font-size: 16px;">${e.name}</p>
        //         </div>
        //         <div class="invoice-content__left__order">
        //           <h3 style="font-size: 18px;">Order</h3>
        //           <p style="font-size: 16px;">${e.type}</p>
        //         </div>
        //         <div class="invoice-content__left__date">
        //           <h3 style="font-size: 18px;">Date</h3>
        //           <p style="font-size: 16px;">${new Date().toLocaleDateString()}</p>
        //         </div>
        //       </div>
        //       <div class="invoice-content__right">
        //         <div class="invoice-content__right__order">
        //           <h3 style="font-size: 18px;">Order</h3>
        //           <p style="font-size: 16px;">${e.name}</p>
        //         </div>
        //         <div class="invoice-content__right__order">
        //           <h3 style="font-size: 18px;">Order</h3>
        //           <p style="font-size: 16px;">${e.name}</p>
        //         </div>
        //         <div class="invoice-content__right__order">
        //           <h3 style="font-size: 18px;">Order</h3>
        //           <p style="font-size: 16px;">${e.name}</p>
        //         </div>
        //       </div>
        //     </div>
        //   </div>
        // `;

        //! invoice button event listener
        // elem
        //   .querySelector("[data-order-item='invoice-btn']")
        //   .addEventListener("click", () => {
        //     generateInvoice(e, elem);
        //   });

        return elem;
      });
      ordersWrapper.append(...orderItems);
    }

    // function generateInvoice(e, element) {
    //   const doc = new jsPDF({
    //     format: "a4",
    //     orientation: "portrait",
    //     unit: "px",
    //   });

    //   // doc.text(singleOrder.name + singleOrder.renderPackage, 1, 1);
    //   doc.html(
    //     `
    //   <div class="invoice-wrapper" style="font-size: 16px;">
    //     <div class="invoice-header">
    //       <div class="invoice-header__logo">
    //         <img
    //           src="https://uploads-ssl.webflow.com/60b9b8f0a5b2f1b3a8b2c7a5/60b9b8f0a5b2f1b3a8b2c7c2_logo.svg"
    //           alt="logo"
    //         />
    //       </div>
    //       <div class="invoice-header__title" style="font-size: 24px;">
    //         <h1>Invoice</h1>
    //       </div>
    //     </div>

    //     <div class="invoice-content">
    //       <div class="invoice-content__left">
    //         <div class="invoice-content__left__customer">
    //           <h3 style="font-size: 18px;">Customer</h3>
    //           <p style="font-size: 16px;">${e.name}</p>
    //         </div>
    //         <div class="invoice-content__left__order">
    //           <h3 style="font-size: 18px;">Order</h3>
    //           <p style="font-size: 16px;">${e.type}</p>
    //         </div>
    //         <div class="invoice-content__left__date">
    //           <h3 style="font-size: 18px;">Date</h3>
    //           <p style="font-size: 16px;">${new Date().toLocaleDateString()}</p>
    //         </div>
    //       </div>
    //       <div class="invoice-content__right">
    //         <div class="invoice-content__right__order">
    //           <h3 style="font-size: 18px;">Order</h3>
    //           <p style="font-size: 16px;">${e.name}</p>
    //         </div>
    //         <div class="invoice-content__right__order">
    //           <h3 style="font-size: 18px;">Order</h3>
    //           <p style="font-size: 16px;">${e.name}</p>
    //         </div>
    //         <div class="invoice-content__right__order">
    //           <h3 style="font-size: 18px;">Order</h3>
    //           <p style="font-size: 16px;">${e.name}</p>
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    // `,
    //     {
    //       callback: function (doc) {
    //         doc.save();
    //       },
    //     }
    //   );
    //   // doc.save("two-by-four.pdf");
    //   // doc.html(element.querySelector("[data-order-item='invoice-data']"), {
    //   //   callback: function (doc) {
    //   //     doc.save();
    //   //   },
    //   // });
    // }

    /**
     * list all materials that are on
     * @param metadata from dropbox
     * @returns string of materials
     */

    function getOnMaterials(metadata) {
      const onMaterials = [];

      // Check each material property in the metadata
      for (const key in metadata) {
        if (
          metadata.hasOwnProperty(key) &&
          metadata[key] === "on" &&
          key.startsWith("material")
        ) {
          // Extract the material name from the property name
          const materialName = key.replace("material", "");
          onMaterials.push(materialName);
        }
        if (
          key.startsWith("comment") &&
          metadata.hasOwnProperty(key) &&
          metadata[key] != "" &&
          !key.startsWith("commentToggle")
        ) {
          const commentName = metadata[key];
          console.log("commentName", commentName);

          onMaterials.push(commentName);
        }
      }

      // Join the onMaterials array into a comma-separated string
      const result = onMaterials.join(", ");

      return result;
    }

    /**
     * get user data structure from dropbox
     */
    async function getUserDataStructure() {
      return new Promise(async (resolve, reject) => {
        try {
          const res =
            (await getFolderList(
              "/CD-uploads/" + CurrentUserEmail,
              accessKey
            )) || "";

          if (res === "") {
            console.log("no folder found");
            return;
          }

          let data = JSON.parse(res);

          // Use Promise.all to wait for all asynchronous operations in the map
          await Promise.all(
            data.entries.map(async (element) => {
              userFolderStructure.push(element.path_lower);
            })
          );

          // Use Promise.all again to wait for all asynchronous operations in the second map
          await Promise.all(
            userFolderStructure.map(async (e) => {
              let result = await getFolderList(e, accessKey);
              let data = JSON.parse(result);
              userVersionedUploads.push(data);
            })
          );
          resolve(userVersionedUploads);
        } catch (error) {
          reject(error); // Reject with the error, no need for console.error here
        }
      });
    }

    /**
     * fill thumbnailSlot
     */
    async function injectThumbnail(data, htmlImage) {
      htmlImage.src = "data:image/jpeg;base64," + data;
    }

    /**
     * get paths in a version/order
     */

    //! removed to test modules

    // async function getOrderFilesPaths(data) {
    //   return new Promise(async (resolve, reject) => {
    //     let paths = [];

    //     await Promise.all(
    //       data.entries.map(async (e) => {
    //         let dropboxItemFullPath = e.path_lower;
    //         const pathObj = { path: dropboxItemFullPath };
    //         paths.push(pathObj);
    //       })
    //     );
    //     resolve(paths);
    //   });
    // }

    /**
     *
     */

    // async function downloadJsonData(paths) {
    //   return new Promise(async (resolve, reject) => {
    //     let data;
    //     await Promise.all(
    //       paths.map(async (e) => {
    //         if (getFileExtension(e.path) == "json") {
    //           data = await downloadDropboxItem(e.path, accessKey);
    //           // singleOrder.order.metadata = data;
    //           // userOrders.push(singleOrder);
    //           // singleOrder = JSON.parse(JSON.stringify(orderTemplate));
    //         }
    //       })
    //     );
    //     console.log("download json finished");
    //     resolve(data);
    //   });
    // }

    // /**
    //  *
    //  * @param orderContentArray get the thumbnails of a specific order
    //  */
    // async function getThumbnailData(orderContentArray, accessKey) {
    //   return new Promise(async (resolve, reject) => {
    //     let paths = [];

    //     paths = await getOrderFilesPaths(orderContentArray);
    //     // console.log("🚀 ~ returnnewPromise ~ paths:", paths);
    //     let orderMetadata = (await downloadJsonData(paths, accessKey)) || "";
    //     // console.log("🚀 ~ returnnewPromise ~ test:", test);
    //     let res = await getBatchThumbnails(paths, accessKey);
    //     // console.log("🚀 ~ returnnewPromise ~ res:", res);
    //     const thumbnails = JSON.parse(res);
    //     const thumbnailsAndJson = { thumbnails, orderMetadata };
    //     resolve(thumbnailsAndJson);
    //   });
    // }

    /**
     * update access token
     */
    async function updateToken() {
      let config = {
        method: "get",
        url: "https://creative-directors-dropbox.sa-60b.workers.dev/api/accesstoken",
      };
      await axios
        .request(config)
        .then((response) => {
          let res = JSON.stringify(response.data);
          accessKey = res.substring(1, res.length - 1);
        })
        .catch((error) => {
          console.log(error);
        });
    }

    // function getFileExtension(fileName) {
    //   // Use lastIndexOf and substring to extract the file extension
    //   const lastDotIndex = fileName.lastIndexOf(".");
    //   if (lastDotIndex === -1) {
    //     // If there's no dot (.), return an empty string or handle as needed
    //     return "";
    //   } else {
    //     return fileName.substring(lastDotIndex + 1);
    //   }
    // }

    // function transformData(originalData) {
    //   return {
    //     order: {
    //       type: originalData["furniture-type"] || "",
    //       name: originalData["furniture-name"] || "",
    //       dimensions: {
    //         width: originalData["furniture-dimension-w"] || "",
    //         height: originalData["furniture-dimension-h"] || "",
    //         length: originalData["furniture-dimension-l"] || "",
    //       },
    //       specialFunction: originalData["special-functions"] || "",
    //       specialFunctionScene: false,
    //       material: originalData["color-finish"] || "",
    //       color: "",
    //       images: [],
    //       extras: {
    //         viewangles: originalData["render-extra-viewangle"] || "",
    //         lightPreferences: "",
    //         roomType: originalData["room-type"] || "",
    //       },
    //       renderPackage: originalData["package-select"] || "",
    //       roomTypeDescription: originalData["dimensions-comment"] || "",
    //       metadata: {
    //         categoryMetal: originalData["category-metal"] || "",
    //         categoryComment: originalData["category-comment"] || "",
    //         materialAluminium: originalData["material-aluminium"] || "",
    //         materialBrass: originalData["material-brass"] || "",
    //         commentMaterial: originalData["comment-material"] || "",
    //         commentWood: originalData["Comment-Wood"] || "",
    //         commentMetal: originalData["Comment-Metal"] || "",
    //         commentPlastic: originalData["Comment-Plastic"] || "",
    //         commentStone: originalData["Comment-Stone"] || "",
    //         commentGlass: originalData["Comment-Glass"] || "",
    //         lightingNoon: originalData["lighting-noon"] || "",
    //         lightingEvening: originalData["lighting-evening"] || "",
    //         lightingComment: originalData["lighting-comment"] || "",
    //         functionShow: originalData["function-show"] || "",
    //         payment: originalData["payment"] || "",
    //       },
    //     },
    //   };
    // }
    function transformData(originalData) {
      return {
        order: {
          type: originalData["furniture-type"] || "",
          name: originalData["furniture-name"] || "",
          dimensions: {
            width: originalData["furniture-dimension-w"] || "",
            height: originalData["furniture-dimension-h"] || "",
            length: originalData["furniture-dimension-l"] || "",
          },
          specialFunction: originalData["special-functions"] || "",
          specialFunctionScene: false,
          material: originalData["color-finish"] || "",
          color: "",
          images: [],
          extras: {
            viewangles: originalData["render-extra-viewangle"] || "",
            lightPreferences: originalData["lighting-comment"] || "",
            roomType: originalData["room-type"] || "",
          },
          renderPackage: originalData["package-select"] || "",
          roomTypeDescription: originalData["dimensions-comment"] || "",
          metadata: {
            categoryComment: originalData["category-comment"] || "",
            categoryWood: originalData["category-wood"] || "",
            categoryMetal: originalData["category-metal"] || "",
            categoryPlastic: originalData["category-plastic"] || "",
            categoryStone: originalData["category-stone"] || "",
            categoryGlass: originalData["category-glass"] || "",
            commentMaterial: originalData["comment-material"] || "",
            commentWood: originalData["Comment-Wood"] || "",
            materialOak: originalData["material-oak"] || "",
            materialWalnut: originalData["material-walnut"] || "",
            materialBeech: originalData["material-beech"] || "",
            materialWhiteOak: originalData["material-whiteoak"] || "",
            materialSteel: originalData["material-steel"] || "",
            materialAluminium: originalData["material-aluminium"] || "",
            materialBrass: originalData["material-brass"] || "",
            commentToggleMetal: originalData["comment-toggle-metal"] || "",
            commentMetal: originalData["Comment-Metal"] || "",
            materialAcrylic: originalData["material-acrylic"] || "",
            materialPolyethylene: originalData["material-polyethylene"] || "",
            materialPVC: originalData["material-pvc"] || "",
            commentPlastic: originalData["Comment-Plastic"] || "",
            materialMarble: originalData["material-marble"] || "",
            materialGranite: originalData["material-granite"] || "",
            materialQuartz: originalData["material-quartz"] || "",
            commentStone: originalData["Comment-Stone"] || "",
            materialTempredGlass: originalData["material-tempredglass"] || "",
            materialFrostedGlass: originalData["material-frostedglass"] || "",
            commentGlass: originalData["Comment-Glass"] || "",
            lightingMorning: originalData["lighting-morning"] || "",
            lightingNoon: originalData["lighting-noon"] || "",
            lightingComment: originalData["lighting-comment"] || "",
            functionShow: originalData["function-show"] || "",
          },
        },
      };
    }

    async function addDataToUserData(serverData) {
      const convertedOrder = transformData(serverData.orderMetadata);
      return new Promise(async (resolve, reject) => {
        await Promise.all(
          serverData.thumbnails.entries.map(async (e) => {
            if (e[".tag"] == "success") {
              convertedOrder.order.images.push({
                name: e.metadata.name,
                path: e.metadata.path_display,
                thumbnail: "data:image/jpeg;base64," + e.thumbnail,
              });
            }
          })
        );

        userOrders.push({ ...convertedOrder.order });
        //  - reset/clean singleOrder
        singleOrder = JSON.parse(JSON.stringify(orderTemplate));
        resolve(userOrders);
      });
    }
    /**
     * get Order Entries With Full Link of the element/image/Entry
     */
    async function getOrderEntries(dataset) {
      return new Promise(async (resolve, reject) => {
        await Promise.all(
          dataset.map(async (version, index) => {
            let tdata = await getThumbnailData(version, accessKey);
            await addDataToUserData(tdata);
            // console.log("🚀 ~ FINAL ~ userOrders:", userOrders);
          })
        );
        resolve(userOrders);
      });
    }

    // async function checkUserFolder(user, accessToken) {
    //   console.log("🚀 ~ checkUserFolder ~ user", user);

    //   return new Promise(async (resolve, reject) => {
    //     let result = await checkFolderExistence(user, accessToken);
    //     resolve(result);
    //   });
    // }
    /**
     * !MAIN INIT
     * init token update
     * init user Structure grabber
     */
    await updateToken()
      .then(() => checkUserFolder(CurrentUserEmail, accessKey))
      .then(() => getUserDataStructure())
      .then(() => {
        //remember the "return"
        let result = getOrderEntries(userVersionedUploads);
        return result;
      })
      .then((result) => {
        updateView(result, template);
      });

    let imagesArray = [];

    if (imageInputField) {
      imageInputField.addEventListener("change", () => {
        const files = imageInputField.files;
        for (let i = 0; i < files.length; i++) {
          imagesArray.push(files[i]);
        }
        displayImages();
      });
    }
    function displayImages() {
      let images = "";
      imagesArray.forEach((image, index) => {
        images += `<div class="upload-queue-images">
              <img src="${URL.createObjectURL(image)}" alt="image">
              <span onclick="deleteImage(${index})">&times;</span>
            </div>`;
      });
      output.innerHTML = images;
    }
    function deleteImage(index) {
      imagesArray.splice(index, 1);
      displayImages();
    }

    //!paypal button init

    // Helper / Utility functions
    let url_to_head = (url) => {
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = url;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          reject("Error loading script.");
        };
        document.head.appendChild(script);
      });
    };
    let handle_close = (event) => {
      event.target.closest(".ms-alert").remove();
    };
    let handle_click = (event) => {
      if (event.target.classList.contains("ms-close")) {
        handle_close(event);
      }
    };
    document.addEventListener("click", handle_click);
    const paypal_sdk_url = "https://www.paypal.com/sdk/js";
    const client_id =
      "AevfJAscX9MKaFWcK--S7rgLBotKliHnYIc94ShGUS3yNpc_Vt7z92LLmH4Tfwl49uRWpesdR6VBbtVx";
    // "AVoZD4EtMXeCRZRcUYr2hfVEfQjZ64IC2HuWi7k9g3kVNegnVazLjJIToMUcnfO3PEjKPWLxaRxz8kkG";
    const currency = "EUR";
    const intent = "capture";

    let alerts = document.getElementById("alerts");
    let package = "none";

    // var packagesWrapper = document.querySelector(".package-select-wrapper")

    //PayPal Code
    //https://developer.paypal.com/sdk/js/configuration/#link-queryparameters
    url_to_head(
      paypal_sdk_url +
        "?client-id=" +
        client_id +
        "&currency=" +
        currency +
        "&intent=" +
        intent
    )
      .then(() => {
        let alerts = document.getElementById("post-payment-alerts"); //!change this to match the id of the div you want to display the alerts in
        let paypal_buttons = paypal.Buttons({
          // https://developer.paypal.com/sdk/js/reference
          onClick: (data) => {
            // https://developer.paypal.com/sdk/js/reference/#link-oninitonclick
            //Custom JS here

            var radioButtons = document.getElementsByName("package-select");
            for (var i = 0; i < radioButtons.length; i++) {
              if (radioButtons[i].checked) {
                package = radioButtons[i].id;
              }
            }
          },
          style: {
            //https://developer.paypal.com/sdk/js/reference/#link-style
            shape: "rect",
            color: "gold",
            layout: "vertical",
            label: "paypal",
          },

          createOrder: function (data, actions) {
            //https://developer.paypal.com/docs/api/orders/v2/#orders_create

            console.log("selected package", package);

            return fetch(
              "https://creative-directors-dropbox.sa-60b.workers.dev/api/paypal/create_order",
              {
                method: "post",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify({ intent: intent, package: package }),
              }
            )
              .then((response) => response.json())
              .then((order) => {
                return order.id;
              });
          },

          onApprove: function (data, actions) {
            let order_id = data.orderID;
            return (
              fetch(
                "https://creative-directors-dropbox.sa-60b.workers.dev/api/paypal/complete_order",
                {
                  method: "post",
                  headers: {
                    "Content-Type": "application/json; charset=utf-8",
                  },
                  body: JSON.stringify({
                    intent: intent,
                    order_id: order_id,
                  }),
                }
              )
                .then((response) => response.json())
                .then((order_details) => {
                  console.log(order_details); //https://developer.paypal.com/docs/api/orders/v2/#orders_capture!c=201&path=create_time&t=response
                  let intent_object =
                    intent === "authorize" ? "authorizations" : "captures";
                  //Custom Successful Message
                  alerts.innerHTML =
                    `<div class=\'ms-alert ms-action\'>Thank you ` +
                    order_details.payer.name.given_name +
                    ` ` +
                    order_details.payer.name.surname +
                    ` for your payment of ` +
                    order_details.purchase_units[0].payments[intent_object][0]
                      .amount.value +
                    ` ` +
                    order_details.purchase_units[0].payments[intent_object][0]
                      .amount.currency_code +
                    `!</div>`;

                  //Close out the PayPal buttons that were rendered
                  paypal_buttons.close();
                })
                //!invoice generation here
                .then(() => {
                  let invoiceData = {
                    name: "slim",
                    type: "bed",
                    renderPackage: "package1",
                  };
                  console.log("invoiceData", invoiceData);
                  generateInvoice(invoiceData);
                })
                .catch((error) => {
                  console.log(error);
                  alerts.innerHTML = `<div class="ms-alert ms-action2 ms-small"><span class="ms-close"></span><p>An Error Ocurred!</p>  </div>`;
                })
            );
          },

          onCancel: function (data) {
            alerts.innerHTML = `<div class="ms-alert ms-action2 ms-small"><span class="ms-close"></span><p>Order cancelled!</p>  </div>`;
          },

          onError: function (err) {
            console.log(err);
          },
        });
        paypal_buttons.render("#payment_options");
      })
      .then(() => {
        console.log("paypal buttons rendered");
      })
      .catch((error) => {
        console.error(error);
      });

    /**
     * form submit handler
     */
    if (form)
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        let requestNext = document.getElementById("request-next");
        if (requestNext) {
          requestNext.style.opacity = "0";
          requestNext.style.pointerEvents = "none";
        }
        let submitLoading = document.getElementById("submit-loading");
        if (submitLoading) submitLoading.style.display = "block";

        const d = new Date();
        const DateID = `${d.getDate()}-${d.getMonth()}-${d.getFullYear()}--${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;

        var formData = new FormData(form);

        {
          // FormData Elements
          let furnitureName = formData.get("furniture-name");
          let furnitureType = formData.get("furniture-type");
          let furnitureDimensionW = formData.get("furniture-dimension-w");
          let furnitureDimensionL = formData.get("furniture-dimension-l");
          let furnitureDimensionH = formData.get("furniture-dimension-h");
          let material = formData.get("material");
          let colorFinish = formData.get("color-finish");
          let specialFunctions = formData.get("special-functions");
          let functionShow = formData.get("function-show");
          let renderPackage = formData.get("render-package");
          let renderExtraViewAngle = formData.get("render-extra-viewangle");
          let renderLight = formData.get("Render-Light");
          let roomType = formData.get("room-type");
          let extraText = formData.get("extra-text");
        }

        async function uploadmetadata(formdata, accesskey, subFolder) {
          return new Promise(async (resolve, reject) => {
            const uploadID = subFolder; //..userEmail/dateID..

            var requestOptions = {
              method: "POST",
              body: formdata,
              redirect: "follow",
            };

            await fetch(
              "https://creative-directors-dropbox.sa-60b.workers.dev/api/uploadmetadata",
              requestOptions
            )
              .then((response) => response.json())
              .then(async (result) => {
                console.log(result);
                const jsonString = JSON.stringify(result, null, 2);
                const pathWithExtension =
                  "/CD-uploads/" + uploadID + "/metadata.json";
                await uploadToDropbox(jsonString, pathWithExtension, accesskey);
              })
              .catch((error) => console.log("error", error));

            resolve("metadata uploaded");
          });
        }

        // !needs to be changed

        var f_email = CurrentUserEmail;

        async function processImages(
          imagesArray: Array<File>,
          f_email,
          accessKey: string
        ) {
          const subFolder = f_email + "/" + DateID;

          await checkFolderExistence(f_email, accessKey);
          await checkFolderExistence(subFolder, accessKey);

          for (let index = 0; index < imagesArray.length; index++) {
            await uploader(f_email, subFolder, imagesArray[index], accessKey);
          }
        }

        // Call the function with your array of images and other parameters

        processImages(imagesArray, f_email, accessKey)
          .then(async () => {
            const subFolder = CurrentUserEmail + "/" + DateID;
            await uploadmetadata(formData, accessKey, subFolder);
            console.log("All images processed.");
            submitLoading.style.display = "none";
            requestNext.style.opacity = "80%";
            requestNext.innerText = "DONE";
          })
          .catch((error) => {
            console.error("Error processing images:", error);
          });

        window.localStorage.removeItem("FormInputHolder");
      });
  }

  console.log("ENV ===> ", process.env.NODE_ENV);
  init();

  saveInputToLocalHost();
});
