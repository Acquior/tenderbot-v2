const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = require('docx');
const fs = require('fs');

const doc = new Document({
  styles: {
    default: { 
      document: { 
        run: { font: "Arial", size: 22 },
        paragraph: { spacing: { line: 276, before: 120, after: 120 } }
      } 
    },
    paragraphStyles: [
      { 
        id: "Title", 
        name: "Title", 
        basedOn: "Normal",
        run: { size: 32, bold: true, color: "000000", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 240 }, alignment: AlignmentType.CENTER } 
      },
      { 
        id: "Heading1", 
        name: "Heading 1", 
        basedOn: "Normal", 
        next: "Normal", 
        quickFormat: true,
        run: { size: 28, bold: true, color: "000000", font: "Arial" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } 
      },
      { 
        id: "Heading2", 
        name: "Heading 2", 
        basedOn: "Normal", 
        next: "Normal", 
        quickFormat: true,
        run: { size: 24, bold: true, color: "000000", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } 
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // Title Page
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun("SHAREHOLDERS AGREEMENT")]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: "MARTECH TECHNOLOGIES (PROPRIETARY) LIMITED", bold: true, size: 24 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "Registration Number: 2021/991351/07", size: 22 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: "Incorporated under the laws of the Republic of South Africa", size: 22 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 120 },
        children: [new TextRun({ text: "BETWEEN", bold: true, size: 24 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "HJM VENTURES (PROPRIETARY) LIMITED", size: 22 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: "(The Shareholder)", size: 22, italics: true })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: "AND", bold: true, size: 24 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "MARTECH TECHNOLOGIES (PROPRIETARY) LIMITED", size: 22 })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 1200 },
        children: [new TextRun({ text: "(The Company)", size: 22, italics: true })]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480 },
        children: [new TextRun({ text: "Date: 28 October 2025", size: 22 })]
      }),
      
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      // TABLE OF CONTENTS
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("TABLE OF CONTENTS")]
      }),
      
      new Paragraph({ children: [new TextRun("1. Definitions and Interpretation")] }),
      new Paragraph({ children: [new TextRun("2. Recitals")] }),
      new Paragraph({ children: [new TextRun("3. Share Capital and Ownership")] }),
      new Paragraph({ children: [new TextRun("4. Management and Governance")] }),
      new Paragraph({ children: [new TextRun("5. Board of Directors")] }),
      new Paragraph({ children: [new TextRun("6. Reserved Matters")] }),
      new Paragraph({ children: [new TextRun("7. Transfer of Shares")] }),
      new Paragraph({ children: [new TextRun("8. Pre-emptive Rights")] }),
      new Paragraph({ children: [new TextRun("9. Drag-Along and Tag-Along Rights")] }),
      new Paragraph({ children: [new TextRun("10. Intellectual Property")] }),
      new Paragraph({ children: [new TextRun("11. Acquior Finance Platform")] }),
      new Paragraph({ children: [new TextRun("12. Future Investment Rounds")] }),
      new Paragraph({ children: [new TextRun("13. Deadlock Resolution")] }),
      new Paragraph({ children: [new TextRun("14. Exit Events")] }),
      new Paragraph({ children: [new TextRun("15. Warranties and Representations")] }),
      new Paragraph({ children: [new TextRun("16. Non-Competition and Confidentiality")] }),
      new Paragraph({ children: [new TextRun("17. Dispute Resolution")] }),
      new Paragraph({ children: [new TextRun("18. General Provisions")] }),
      new Paragraph({ children: [new TextRun("Schedule A: Share Register")] }),
      new Paragraph({ children: [new TextRun("Schedule B: Board Composition")] }),
      new Paragraph({ children: [new TextRun("Schedule C: Reserved Matters")] }),
      new Paragraph({ children: [new TextRun("Schedule D: Deed of Adherence")] }),
      
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      // SECTION 1
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("1. DEFINITIONS AND INTERPRETATION")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("1.1 Definitions")]
      }),
      
      new Paragraph({
        children: [new TextRun("In this Agreement, unless the context indicates otherwise:")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Acquior Finance\" or \"Acquior Platform\" means the blockchain-based invoice factoring platform and all related intellectual property, technology, and business operations currently owned and operated by the Company;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Act\" means the Companies Act 71 of 2008, as amended;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Board\" means the board of directors of the Company;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Business Day\" means any day other than a Saturday, Sunday or official public holiday in the Republic of South Africa;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Company\" means Martech Technologies (Proprietary) Limited, registration number 2021/991351/07, a private company duly incorporated under the laws of South Africa;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Drag-Along Event\" means a bona fide offer to purchase all of the Shares in the Company;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Encumbrance\" means any mortgage, charge, pledge, lien, option, restriction, right of first refusal, right of pre-emption, third party right or interest, other encumbrance or security interest of any kind;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Founder\" means Hlanganiso Maluleke, the ultimate beneficial owner of HJM Ventures;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Intellectual Property\" means all patents, trademarks, service marks, trade names, domain names, copyrights, trade secrets, know-how, and other intellectual property rights, whether registered or unregistered;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Investment Round\" means any issuance of new Shares by the Company to raise capital;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"MOI\" means the Memorandum of Incorporation of the Company;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"New Investor\" means any person who acquires Shares in the Company following the date of this Agreement;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Reserved Matters\" means those matters set out in Schedule C;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Shareholder\" means HJM Ventures (Proprietary) Limited and any New Investor who becomes a party to this Agreement;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Shares\" means ordinary shares in the issued share capital of the Company;")]
      }),
      
      new Paragraph({
        children: [new TextRun("• \"Tag-Along Event\" means any proposed transfer of Shares by a Shareholder to a third party.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("1.2 Interpretation")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "1.2.1 ", bold: true }), new TextRun("In this Agreement, unless the context indicates otherwise:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• words importing the singular include the plural and vice versa;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• words importing any gender include the other genders;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• a reference to natural persons includes legal persons and vice versa;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• clause headings are for convenience only and shall not affect interpretation;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• any reference to currency shall mean South African Rand unless otherwise specified.")]
      }),

      // SECTION 2
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("2. RECITALS")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.1 ", bold: true }), new TextRun("The Company was incorporated on 12 November 2021 as a private company in terms of the Act.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.2 ", bold: true }), new TextRun("HJM Ventures currently holds 100% of the issued share capital of the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.3 ", bold: true }), new TextRun("The parties acknowledge and confirm that the Company is a wholly owned subsidiary of HJM Ventures, and that the Founder is the ultimate beneficial owner of both entities. This corporate structure shall be maintained in all corporate records and financial statements.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.4 ", bold: true }), new TextRun("The Company has developed and owns the Acquior Finance platform, a blockchain-based invoice factoring solution.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.5 ", bold: true }), new TextRun("The parties wish to record their agreement regarding the governance of the Company, the rights and obligations of shareholders, and the protection of the Company's intellectual property.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.6 ", bold: true }), new TextRun("The parties anticipate that the Company may seek external investment funding and wish to establish a framework for future Investment Rounds.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2.7 ", bold: true }), new TextRun("The Company may in future establish Acquior Finance as a separate legal entity, subject to the provisions of this Agreement.")]
      }),

      // SECTION 3
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("3. SHARE CAPITAL AND OWNERSHIP")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.1 Current Share Capital")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3.1.1 ", bold: true }), new TextRun("The authorised share capital of the Company is 10,000,000 ordinary shares with a par value of R0.01 each, totaling R100,000.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3.1.2 ", bold: true }), new TextRun("The issued share capital of the Company as at the date of this Agreement is as set out in Schedule A.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3.1.3 ", bold: true }), new TextRun("HJM Ventures holds 1,000,000 shares, representing 100% of the issued shares, free from any Encumbrances.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.2 Share Certificates")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3.2.1 ", bold: true }), new TextRun("The Company shall issue share certificates to the Shareholder in respect of the Shares held, in accordance with the Act and the MOI.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3.2.2 ", bold: true }), new TextRun("All share certificates shall be retained by the Company or its appointed transfer secretaries.")]
      }),

      // SECTION 4
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("4. MANAGEMENT AND GOVERNANCE")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.1 General Principles")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4.1.1 ", bold: true }), new TextRun("The business and affairs of the Company shall be managed by the Board in accordance with the Act, the MOI and this Agreement.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4.1.2 ", bold: true }), new TextRun("The Board shall act in the best interests of the Company and all its Shareholders at all times.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4.1.3 ", bold: true }), new TextRun("The day-to-day operations of the Company shall be managed by the Chief Executive Officer, subject to the overall supervision and control of the Board.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.2 Chief Executive Officer")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4.2.1 ", bold: true }), new TextRun("The Founder shall serve as Chief Executive Officer of the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4.2.2 ", bold: true }), new TextRun("The CEO shall have such powers and duties as may be delegated to him by the Board from time to time.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4.2.3 ", bold: true }), new TextRun("The CEO may only be removed from office by a unanimous resolution of the Board, provided that such removal shall not affect any rights the CEO may have under a separate employment or service agreement.")]
      }),

      // SECTION 5
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("5. BOARD OF DIRECTORS")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("5.1 Board Composition")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.1.1 ", bold: true }), new TextRun("The Board shall consist of such number of directors as may be determined by the Shareholder from time to time, subject to a minimum of one director.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.1.2 ", bold: true }), new TextRun("The initial Board composition is set out in Schedule B.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.1.3 ", bold: true }), new TextRun("HJM Ventures, as the sole Shareholder, shall have the right to appoint and remove all directors.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.1.4 ", bold: true }), new TextRun("Upon the admission of New Investors holding more than 15% of the issued share capital, the Board composition and appointment rights may be renegotiated.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("5.2 Board Meetings")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.2.1 ", bold: true }), new TextRun("The Board shall meet at least quarterly, or more frequently as required.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.2.2 ", bold: true }), new TextRun("A quorum for Board meetings shall be a majority of the directors, unless otherwise specified in the MOI.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.2.3 ", bold: true }), new TextRun("Board meetings may be conducted by telephone, video conference or other electronic means, provided all directors can participate and communicate effectively.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.2.4 ", bold: true }), new TextRun("Decisions of the Board shall be taken by simple majority vote, unless this Agreement or the MOI requires a higher threshold.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("5.3 Directors' Duties")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.3.1 ", bold: true }), new TextRun("Each director shall comply with their fiduciary duties and duties of care, skill and diligence as prescribed by the Act.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5.3.2 ", bold: true }), new TextRun("Directors shall disclose any conflicts of interest and shall not vote on matters in which they have a material personal interest.")]
      }),

      // SECTION 6
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("6. RESERVED MATTERS")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "6.1 ", bold: true }), new TextRun("Notwithstanding any other provision of this Agreement or the MOI, the Company shall not, without the prior written consent of Shareholders holding at least 75% of the issued share capital (or such higher threshold as may be required by the Act), undertake any Reserved Matter as set out in Schedule C.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "6.2 ", bold: true }), new TextRun("For so long as HJM Ventures holds 100% of the issued share capital, HJM Ventures may approve any Reserved Matter by written resolution.")]
      }),

      // SECTION 7
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("7. TRANSFER OF SHARES")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("7.1 Restrictions on Transfer")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.1.1 ", bold: true }), new TextRun("No Shareholder may transfer any Shares except in accordance with this Agreement.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.1.2 ", bold: true }), new TextRun("All transfers of Shares shall be free from any Encumbrances, unless otherwise agreed in writing by all Shareholders.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.1.3 ", bold: true }), new TextRun("Any purported transfer of Shares in breach of this Agreement shall be void and of no effect.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("7.2 Permitted Transfers")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.2.1 ", bold: true }), new TextRun("A Shareholder may transfer Shares:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• to an affiliate or related company controlled by the Shareholder;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• to a trust established for the benefit of the Shareholder or its beneficial owners;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• to immediate family members of the Shareholder's beneficial owners;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("provided that the transferee executes a deed of adherence to this Agreement and becomes bound by all its terms.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("7.3 Right of First Refusal")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.3.1 ", bold: true }), new TextRun("If a Shareholder wishes to transfer Shares to a third party (other than a permitted transfer), the Shareholder must first offer those Shares to the other Shareholders.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.3.2 ", bold: true }), new TextRun("The offer shall be in writing and shall specify the number of Shares offered, the proposed price and payment terms, and the identity of the proposed purchaser.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.3.3 ", bold: true }), new TextRun("The other Shareholders shall have 30 Business Days to accept the offer on the same terms and conditions.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7.3.4 ", bold: true }), new TextRun("If the offer is not accepted within the 30 Business Day period, the selling Shareholder may proceed with the proposed sale to the third party, provided such sale is completed within 90 Business Days on terms no less favorable than those offered to the other Shareholders.")]
      }),

      // SECTION 8
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("8. PRE-EMPTIVE RIGHTS")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "8.1 ", bold: true }), new TextRun("If the Company proposes to issue new Shares for cash consideration, each existing Shareholder shall have the right to subscribe for such number of new Shares as will maintain their proportionate shareholding in the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "8.2 ", bold: true }), new TextRun("The Company shall give written notice to each Shareholder of any proposed issuance of new Shares, specifying the number of Shares to be issued, the price per Share and the terms of payment.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "8.3 ", bold: true }), new TextRun("Each Shareholder shall have 20 Business Days from the date of such notice to exercise their pre-emptive rights by written notice to the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "8.4 ", bold: true }), new TextRun("To the extent that a Shareholder does not exercise their pre-emptive rights, the unsubscribed Shares may be allocated to other Shareholders who have over-subscribed, or offered to new investors.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "8.5 ", bold: true }), new TextRun("Pre-emptive rights shall not apply to:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• Shares issued pursuant to an employee share option plan or similar incentive scheme approved by Shareholders holding 75% of the issued share capital;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• Shares issued as consideration for the acquisition of a business or assets;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• Shares issued in connection with a strategic partnership approved by Shareholders holding 75% of the issued share capital.")]
      }),

      // SECTION 9
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("9. DRAG-ALONG AND TAG-ALONG RIGHTS")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("9.1 Drag-Along Rights")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.1.1 ", bold: true }), new TextRun("If Shareholders holding more than 75% of the issued share capital (the \"Drag-Along Sellers\") receive a bona fide offer from a third party to purchase all of their Shares, and such Drag-Along Sellers wish to accept the offer, they may require all other Shareholders to sell their Shares on the same terms and conditions.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.1.2 ", bold: true }), new TextRun("The Drag-Along Sellers shall give written notice to all other Shareholders of the proposed sale, specifying the identity of the purchaser, the price and terms of payment, and requiring the other Shareholders to sell their Shares.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.1.3 ", bold: true }), new TextRun("Each Shareholder subject to drag-along rights shall take all necessary steps to consummate the sale, including executing transfer documents and providing warranties and indemnities on the same basis as the Drag-Along Sellers.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("9.2 Tag-Along Rights")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.2.1 ", bold: true }), new TextRun("If a Shareholder (the \"Selling Shareholder\") proposes to sell Shares to a third party, and such sale would result in the third party holding more than 25% of the issued share capital, each other Shareholder shall have the right to participate in the sale on a pro rata basis.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.2.2 ", bold: true }), new TextRun("The Selling Shareholder shall give written notice to all other Shareholders of the proposed sale, specifying the number of Shares to be sold, the identity of the purchaser and the price and terms of payment.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.2.3 ", bold: true }), new TextRun("Each other Shareholder shall have 15 Business Days to notify the Selling Shareholder of their intention to participate in the sale.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9.2.4 ", bold: true }), new TextRun("If one or more Shareholders elect to tag along, the Selling Shareholder must reduce the number of Shares they sell to accommodate the participating Shareholders on a pro rata basis.")]
      }),

      // SECTION 10
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("10. INTELLECTUAL PROPERTY")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "10.1 ", bold: true }), new TextRun("The Company shall own all Intellectual Property developed or acquired in connection with its business, including but not limited to the Acquior Finance platform.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "10.2 ", bold: true }), new TextRun("The Founder and all employees, contractors and consultants of the Company shall execute such documents as may be necessary to assign all Intellectual Property rights to the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "10.3 ", bold: true }), new TextRun("The Company shall take all reasonable steps to protect its Intellectual Property, including registering trademarks and patents where appropriate.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "10.4 ", bold: true }), new TextRun("No Shareholder may use the Company's Intellectual Property for their own benefit or for the benefit of any third party without the prior written consent of the Board.")]
      }),

      // SECTION 11
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("11. ACQUIOR FINANCE PLATFORM")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("11.1 Current Status")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.1.1 ", bold: true }), new TextRun("The Acquior Finance platform is currently a product and asset of the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.1.2 ", bold: true }), new TextRun("All Intellectual Property, technology, branding, contracts and other assets related to Acquior Finance are owned by the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.1.3 ", bold: true }), new TextRun("The Company shall maintain proper records of all development work, expenses and investments related to Acquior Finance.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("11.2 Potential Spin-Off")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.2.1 ", bold: true }), new TextRun("The parties acknowledge that Acquior Finance may in future be established as a separate legal entity (a \"Spin-Off\").")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.2.2 ", bold: true }), new TextRun("Any Spin-Off shall require approval as a Reserved Matter in accordance with Clause 6.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.2.3 ", bold: true }), new TextRun("In the event of a Spin-Off:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• The Company shall receive shares in the new entity proportionate to the value contributed;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• Shareholders of the Company shall have pre-emptive rights to invest in the new entity on the same terms as the Company;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• The Company may distribute shares in the new entity to its Shareholders on a pro rata basis, subject to tax and legal considerations;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• Appropriate intellectual property licenses or transfers shall be executed to ensure the new entity can operate effectively.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11.2.4 ", bold: true }), new TextRun("The terms of any Spin-Off shall be negotiated in good faith between the parties at the relevant time, taking into account the interests of all Shareholders and the Company.")]
      }),

      // SECTION 12
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("12. FUTURE INVESTMENT ROUNDS")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "12.1 ", bold: true }), new TextRun("The parties acknowledge that the Company intends to seek external investment funding, including but not limited to funding from KIPP SMEGS or other institutional investors.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "12.2 ", bold: true }), new TextRun("Any Investment Round shall be subject to the pre-emptive rights provisions in Clause 8, unless waived by the relevant Shareholders.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "12.3 ", bold: true }), new TextRun("New Investors shall be required to execute a deed of adherence to this Agreement and become bound by all its terms, unless otherwise agreed by Shareholders holding 75% of the issued share capital.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "12.4 ", bold: true }), new TextRun("The terms of any Investment Round, including valuation, pricing, governance rights and investor protections, shall be negotiated in good faith and approved as a Reserved Matter.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "12.5 ", bold: true }), new TextRun("HJM Ventures acknowledges that New Investors may require amendments to this Agreement, including enhanced minority protection rights, board representation and veto rights over certain matters, and agrees to negotiate such amendments in good faith.")]
      }),

      // SECTION 13
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("13. DEADLOCK RESOLUTION")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "13.1 ", bold: true }), new TextRun("This clause shall only apply when there are two or more Shareholders and a deadlock situation arises where the Board or Shareholders are unable to reach agreement on a material matter affecting the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "13.2 ", bold: true }), new TextRun("If a deadlock arises, the parties shall first attempt to resolve the matter through good faith negotiations over a period of 30 Business Days.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "13.3 ", bold: true }), new TextRun("If the deadlock cannot be resolved through negotiations, the matter may be referred to mediation in accordance with the dispute resolution procedures in Clause 17.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "13.4 ", bold: true }), new TextRun("As a last resort, if the deadlock remains unresolved after mediation, any Shareholder may initiate a buy-sell procedure whereby one Shareholder offers to either buy out the other Shareholder(s) or sell their Shares to the other Shareholder(s) at a specified price, with the other Shareholder(s) having the right to choose whether to buy or sell.")]
      }),

      // SECTION 14
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("14. EXIT EVENTS")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("14.1 Sale of the Company")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14.1.1 ", bold: true }), new TextRun("If the Company receives a bona fide offer to purchase all or substantially all of its assets or business, the Board shall consider the offer in good faith and make a recommendation to the Shareholders.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14.1.2 ", bold: true }), new TextRun("Any sale of all or substantially all of the Company's assets or business shall require approval by Shareholders holding at least 75% of the issued share capital, in accordance with the Act and the MOI.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("14.2 Initial Public Offering")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14.2.1 ", bold: true }), new TextRun("The Company may pursue an initial public offering (IPO) or listing on a recognized stock exchange, subject to approval by Shareholders holding at least 75% of the issued share capital.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14.2.2 ", bold: true }), new TextRun("In the event of an IPO, this Agreement shall remain in force to the extent permitted by the listing requirements of the relevant exchange, and the parties shall negotiate in good faith any necessary amendments.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("14.3 Liquidation")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14.3.1 ", bold: true }), new TextRun("The Company shall not be wound up or liquidated except in accordance with the Act and with the approval of Shareholders holding at least 75% of the issued share capital.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14.3.2 ", bold: true }), new TextRun("In the event of liquidation, assets shall be distributed in accordance with the Act and the MOI.")]
      }),

      // SECTION 15
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("15. WARRANTIES AND REPRESENTATIONS")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "15.1 ", bold: true }), new TextRun("HJM Ventures warrants and represents to the Company that:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• It is duly incorporated and validly existing under the laws of South Africa;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• It has full power and authority to enter into and perform this Agreement;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• The Shares held by it are legally and beneficially owned by it, free from any Encumbrances;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• This Agreement constitutes valid and binding obligations enforceable against it in accordance with its terms.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "15.2 ", bold: true }), new TextRun("The Company warrants and represents to HJM Ventures that:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• It is duly incorporated and validly existing under the laws of South Africa;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• It has full power and authority to enter into and perform this Agreement;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• The execution and performance of this Agreement will not violate any law or any agreement to which it is a party;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• All Intellectual Property material to its business is owned by it or properly licensed to it.")]
      }),

      // SECTION 16
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("16. NON-COMPETITION AND CONFIDENTIALITY")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("16.1 Non-Competition")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "16.1.1 ", bold: true }), new TextRun("For so long as a person holds Shares in the Company and for a period of 12 months following cessation of their shareholding, such person shall not, without the prior written consent of the Board:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• directly or indirectly engage in or be interested in any business that competes with the Company's business;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• solicit or entice away any employee, contractor, customer or supplier of the Company;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• use any confidential information or Intellectual Property of the Company for any purpose other than the business of the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "16.1.2 ", bold: true }), new TextRun("The restrictions in this clause shall apply only to the extent reasonable to protect the legitimate business interests of the Company and shall not prevent a person from:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• holding up to 5% of the shares in a publicly listed competing company as a passive investment;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• engaging in business activities that do not directly compete with the core business of the Company.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("16.2 Confidentiality")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "16.2.1 ", bold: true }), new TextRun("Each Shareholder undertakes to keep confidential all information relating to the Company, its business, operations, financial affairs and this Agreement.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "16.2.2 ", bold: true }), new TextRun("Confidential information may only be disclosed:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• with the prior written consent of the Company;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• to the extent required by law or by a court or regulatory authority;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• to the Shareholder's professional advisers, provided they are bound by equivalent confidentiality obligations;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• to the extent the information is in the public domain through no fault of the Shareholder.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "16.2.3 ", bold: true }), new TextRun("The confidentiality obligations in this clause shall survive termination of this Agreement and shall continue for a minimum period of 5 years post-termination, and indefinitely with respect to trade secrets, proprietary technology, and information that remains confidential and commercially sensitive.")]
      }),

      // SECTION 17
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("17. DISPUTE RESOLUTION")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.1 ", bold: true }), new TextRun("Any dispute arising out of or in connection with this Agreement, including any question regarding its existence, validity or termination, shall be resolved in accordance with this clause.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.2 ", bold: true }), new TextRun("The parties shall first attempt to resolve the dispute through good faith negotiations over a period of 15 Business Days.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.3 ", bold: true }), new TextRun("If the dispute cannot be resolved through negotiations, the parties shall attempt to resolve it through mediation administered by the Arbitration Foundation of Southern Africa (AFSA) in accordance with its mediation rules.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.4 ", bold: true }), new TextRun("If the dispute is not resolved through mediation within 30 Business Days, it shall be finally resolved by arbitration in accordance with the rules of AFSA.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.5 ", bold: true }), new TextRun("The arbitration shall be conducted by a single arbitrator appointed in accordance with AFSA rules, unless the parties agree otherwise.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.6 ", bold: true }), new TextRun("The seat of arbitration shall be Johannesburg, South Africa, and the language of arbitration shall be English.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.7 ", bold: true }), new TextRun("The decision of the arbitrator shall be final and binding on the parties and may be made an order of court.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17.8 ", bold: true }), new TextRun("Nothing in this clause shall prevent a party from seeking urgent interim or interlocutory relief from a court of competent jurisdiction.")]
      }),

      // SECTION 18
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("18. GENERAL PROVISIONS")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.1 Amendment")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.1.1 ", bold: true }), new TextRun("This Agreement may only be amended by written agreement signed by all parties.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.1.2 ", bold: true }), new TextRun("No oral amendments or variations shall be valid or binding.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.2 Entire Agreement")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.2.1 ", bold: true }), new TextRun("This Agreement constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior agreements, understandings and representations.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.3 Relationship with MOI")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.3.1 ", bold: true }), new TextRun("This Agreement is supplemental to and shall be read together with the MOI of the Company.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.3.2 ", bold: true }), new TextRun("In the event of any conflict or inconsistency between the provisions of this Agreement and the MOI, the MOI shall prevail to the extent required by the Act, and the parties undertake to amend this Agreement to conform with the MOI.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.4 Severability")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.4.1 ", bold: true }), new TextRun("If any provision of this Agreement is held to be invalid or unenforceable, such provision shall be severed and the remaining provisions shall continue in full force and effect.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.4.2 ", bold: true }), new TextRun("The parties shall negotiate in good faith to replace any invalid or unenforceable provision with a valid and enforceable provision that achieves the same or similar economic effect.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.5 Notices")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.5.1 ", bold: true }), new TextRun("All notices under this Agreement shall be in writing and shall be delivered by hand, registered post, email or telefax to the addresses set out below or such other address as a party may notify to the others:")]
      }),
      
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: "The Company:", bold: true })]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Martech Technologies (Proprietary) Limited")]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Address: [INSERT REGISTERED ADDRESS]")]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Email: hlanganiso@martechgroup.co.za")]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Attention: Hlanganiso Maluleke")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "HJM Ventures:", bold: true })]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("HJM Ventures (Proprietary) Limited")]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Address: [INSERT ADDRESS]")]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Email: hlanganiso@acquior.com")]
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [new TextRun("Attention: Hlanganiso Maluleke")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "18.5.2 ", bold: true }), new TextRun("Notices shall be deemed to have been received:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• if delivered by hand, on the date of delivery;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• if sent by registered post, 5 Business Days after posting;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• if sent by email during business hours, immediately, or if sent outside business hours, on the next Business Day.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.6 Governing Law")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.6.1 ", bold: true }), new TextRun("This Agreement shall be governed by and construed in accordance with the laws of the Republic of South Africa.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.6.2 ", bold: true }), new TextRun("The parties consent to the non-exclusive jurisdiction of the High Court of South Africa (Gauteng Division, Johannesburg) in respect of any proceedings arising out of this Agreement, subject to the dispute resolution provisions in Clause 17.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.7 Counterparts")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.7.1 ", bold: true }), new TextRun("This Agreement may be executed in any number of counterparts, each of which shall be deemed an original and all of which together shall constitute one instrument.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.7.2 ", bold: true }), new TextRun("Electronic signatures shall be valid and binding for purposes of this Agreement.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.8 Costs")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.8.1 ", bold: true }), new TextRun("Each party shall bear its own costs in relation to the negotiation, preparation and execution of this Agreement.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("18.9 Further Assurances")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18.9.1 ", bold: true }), new TextRun("Each party shall execute such further documents and do such further acts as may be reasonably necessary to give effect to the provisions of this Agreement.")]
      }),

      // SIGNATURES PAGE
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 480 },
        children: [new TextRun({ text: "SIGNATURE PAGE", bold: true, size: 28 })]
      }),
      
      new Paragraph({
        children: [new TextRun("SIGNED at _________________ on this _____ day of _________________ 20___")]
      }),
      
      new Paragraph({
        spacing: { before: 480 },
        children: [new TextRun({ text: "FOR AND ON BEHALF OF MARTECH TECHNOLOGIES (PROPRIETARY) LIMITED:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun("_____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("Name: Hlanganiso Maluleke")]
      }),
      new Paragraph({
        children: [new TextRun("Title: Director")]
      }),
      new Paragraph({
        children: [new TextRun("Who warrants authority to sign on behalf of the Company")]
      }),
      
      new Paragraph({
        spacing: { before: 480 },
        children: [new TextRun({ text: "FOR AND ON BEHALF OF HJM VENTURES (PROPRIETARY) LIMITED:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun("_____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("Name: Hlanganiso Maluleke")]
      }),
      new Paragraph({
        children: [new TextRun("Title: Director")]
      }),
      new Paragraph({
        children: [new TextRun("Who warrants authority to sign on behalf of HJM Ventures")]
      }),
      
      new Paragraph({
        spacing: { before: 480 },
        children: [new TextRun({ text: "WITNESS:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun("1. _____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("   Name: ")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun("2. _____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("   Name: ")]
      }),

      // SCHEDULE A
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SCHEDULE A: SHARE REGISTER")]
      }),
      
      new Paragraph({
        children: [new TextRun("As at the date of this Agreement, the issued share capital of Martech Technologies (Proprietary) Limited is as follows:")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "Authorized Share Capital:", bold: true })]
      }),
      new Paragraph({
        children: [new TextRun("Number of Shares: 10,000,000 ordinary shares")]
      }),
      new Paragraph({
        children: [new TextRun("Par Value: R0.01 per share")]
      }),
      new Paragraph({
        children: [new TextRun("Total Authorized Capital: R100,000")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "Currently Issued Share Capital:", bold: true })]
      }),
      new Paragraph({
        children: [new TextRun("Total Issued: 1,000,000 ordinary shares")]
      }),
      new Paragraph({
        children: [new TextRun("Total Issued Capital: R10,000")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "Shareholder Details:", bold: true })]
      }),
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: "Shareholder: HJM Ventures (Proprietary) Limited", bold: true })]
      }),
      new Paragraph({
        children: [new TextRun("Registration Number: 2025/225073/07")]
      }),
      new Paragraph({
        children: [new TextRun("Number of Shares: 1,000,000")]
      }),
      new Paragraph({
        children: [new TextRun("Par Value per Share: R0.01")]
      }),
      new Paragraph({
        children: [new TextRun("Total Consideration Paid: R10,000")]
      }),
      new Paragraph({
        children: [new TextRun("Percentage Holding: 100%")]
      }),
      new Paragraph({
        children: [new TextRun("Class of Shares: Ordinary")]
      }),

      // SCHEDULE B
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SCHEDULE B: BOARD COMPOSITION")]
      }),
      
      new Paragraph({
        children: [new TextRun("As at the date of this Agreement, the Board of Directors of Martech Technologies (Proprietary) Limited consists of:")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "Director 1:", bold: true })]
      }),
      new Paragraph({
        children: [new TextRun("Name: Hlanganiso Maluleke")]
      }),
      new Paragraph({
        children: [new TextRun("ID Number: 9703135849081")]
      }),
      new Paragraph({
        children: [new TextRun("Appointed by: HJM Ventures (Proprietary) Limited")]
      }),
      new Paragraph({
        children: [new TextRun("Role: Executive Director and Chief Executive Officer")]
      }),
      new Paragraph({
        children: [new TextRun("Date of Appointment: 7 October 2025")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun("[Additional directors to be listed as appointed]")]
      }),

      // SCHEDULE C
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SCHEDULE C: RESERVED MATTERS")]
      }),
      
      new Paragraph({
        children: [new TextRun("The following matters shall require approval by Shareholders holding at least 75% of the issued share capital (or such higher threshold as required by the Companies Act):")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "1. ", bold: true }), new TextRun("Any amendment to the MOI;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2. ", bold: true }), new TextRun("Any increase or reduction in the authorised or issued share capital;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3. ", bold: true }), new TextRun("Any issuance of new shares or securities convertible into shares (except pursuant to approved employee incentive schemes);")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4. ", bold: true }), new TextRun("Any merger, acquisition, consolidation or other business combination;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5. ", bold: true }), new TextRun("Any sale, transfer, lease or disposal of all or substantially all of the Company's assets or business;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "6. ", bold: true }), new TextRun("Any sale, transfer or licensing of the Acquior Finance platform or related Intellectual Property;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7. ", bold: true }), new TextRun("The establishment of Acquior Finance as a separate legal entity (Spin-Off);")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "8. ", bold: true }), new TextRun("Any liquidation, dissolution or winding up of the Company;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "9. ", bold: true }), new TextRun("Any change in the nature or scope of the Company's business;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "10. ", bold: true }), new TextRun("Any borrowing exceeding R1,000,000 in aggregate;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "11. ", bold: true }), new TextRun("Any granting of security over the Company's assets exceeding R500,000 in aggregate;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "12. ", bold: true }), new TextRun("Any related party transactions exceeding R500,000;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "13. ", bold: true }), new TextRun("Approval of annual budgets and material deviations therefrom (exceeding 20%);")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "14. ", bold: true }), new TextRun("Appointment or removal of the Chief Executive Officer;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "15. ", bold: true }), new TextRun("Appointment or removal of the Company's auditors;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "16. ", bold: true }), new TextRun("Any change in the Company's accounting policies or financial year end;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "17. ", bold: true }), new TextRun("Declaration of any dividend or distribution;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "18. ", bold: true }), new TextRun("Entry into any material agreement with a term exceeding 2 years or value exceeding R2,000,000;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "19. ", bold: true }), new TextRun("Initiation or settlement of any litigation involving amounts exceeding R1,000,000;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "20. ", bold: true }), new TextRun("Establishment of any subsidiary or joint venture;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "21. ", bold: true }), new TextRun("Any material change to employee benefit schemes or executive compensation exceeding R100,000 per annum per person;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "22. ", bold: true }), new TextRun("Implementation of any employee share option scheme or similar equity incentive plan.")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun({ text: "Note:", italics: true }), new TextRun({ text: " These thresholds may be amended by agreement between the parties as the Company grows and investment rounds are completed.", italics: true })]
      }),

      // SCHEDULE D
      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SCHEDULE D: DEED OF ADHERENCE")]
      }),
      
      new Paragraph({
        children: [new TextRun("This template shall be executed by any New Investor acquiring Shares in the Company following the date of the principal Shareholders Agreement.")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "DEED OF ADHERENCE", bold: true, size: 24 })]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun("TO THE SHAREHOLDERS AGREEMENT")]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [new TextRun("DATED [INSERT DATE OF PRINCIPAL AGREEMENT]")]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun("RELATING TO")]
      }),
      
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: "MARTECH TECHNOLOGIES (PROPRIETARY) LIMITED", bold: true })]
      }),
      
      new Paragraph({
        children: [new TextRun("This Deed of Adherence is executed on _________________ [DATE] by:")]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: "NEW INVESTOR:", bold: true })]
      }),
      
      new Paragraph({
        children: [new TextRun("Full Name/Entity Name: _________________________________")]
      }),
      
      new Paragraph({
        children: [new TextRun("Registration/ID Number: _________________________________")]
      }),
      
      new Paragraph({
        children: [new TextRun("Address: _________________________________")]
      }),
      
      new Paragraph({
        children: [new TextRun("         _________________________________")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun({ text: "RECITALS:", bold: true })]
      }),
      
      new Paragraph({
        children: [new TextRun("• The existing shareholders of Martech Technologies (Proprietary) Limited (the \"Company\") entered into a Shareholders Agreement dated [INSERT DATE] (the \"Agreement\").")]
      }),
      
      new Paragraph({
        children: [new TextRun("• The New Investor has agreed to acquire [INSERT NUMBER] Shares in the Company, representing [INSERT]% of the issued share capital.")]
      }),
      
      new Paragraph({
        children: [new TextRun("• As a condition of acquiring the Shares, the New Investor is required to become a party to and be bound by the terms of the Agreement.")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun({ text: "NOW THEREFORE, the New Investor hereby:", bold: true })]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "1. ", bold: true }), new TextRun("Acknowledges that it has received, read and fully understands the Agreement;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "2. ", bold: true }), new TextRun("Agrees to become a party to the Agreement as a \"Shareholder\" (as defined in the Agreement);")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "3. ", bold: true }), new TextRun("Undertakes to comply with and be bound by all the terms, conditions, obligations and restrictions contained in the Agreement as if it were an original party thereto;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "4. ", bold: true }), new TextRun("Confirms that the Shares acquired shall be subject to all the terms of the Agreement, including all restrictions on transfer;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "5. ", bold: true }), new TextRun("Agrees that all notices to it shall be sent to the address set out above, or such other address as it may notify in writing;")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "6. ", bold: true }), new TextRun("Represents and warrants that:")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• it has full power and authority to enter into this Deed of Adherence;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• this Deed of Adherence constitutes valid and binding obligations enforceable against it;")]
      }),
      
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun("• the execution and performance of this Deed will not violate any law or agreement to which it is a party.")]
      }),
      
      new Paragraph({
        children: [new TextRun({ text: "7. ", bold: true }), new TextRun("Agrees that this Deed of Adherence shall be governed by the laws of the Republic of South Africa and subject to the dispute resolution provisions in the Agreement.")]
      }),
      
      new Paragraph({
        spacing: { before: 480 },
        children: [new TextRun({ text: "EXECUTED AS A DEED:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun("SIGNED at _________________ on _________________")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun({ text: "FOR AND ON BEHALF OF THE NEW INVESTOR:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun("_____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("Signature")]
      }),
      
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun("_____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("Name and Title (if signing on behalf of entity)")]
      }),
      
      new Paragraph({
        spacing: { before: 360 },
        children: [new TextRun({ text: "WITNESSES:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 180 },
        children: [new TextRun("1. _____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("   Name:")]
      }),
      new Paragraph({
        children: [new TextRun("   Signature:")]
      }),
      
      new Paragraph({
        spacing: { before: 180 },
        children: [new TextRun("2. _____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("   Name:")]
      }),
      new Paragraph({
        children: [new TextRun("   Signature:")]
      }),
      
      new Paragraph({
        spacing: { before: 480 },
        children: [new TextRun({ text: "ACKNOWLEDGED AND ACCEPTED by the Company:", bold: true })]
      }),
      
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun("_____________________________________")]
      }),
      new Paragraph({
        children: [new TextRun("Director: Martech Technologies (Pty) Ltd")]
      }),
      new Paragraph({
        children: [new TextRun("Name:")]
      }),
      new Paragraph({
        children: [new TextRun("Date:")]
      }),

      new Paragraph({
        pageBreakBefore: true,
        children: []
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480 },
        children: [new TextRun({ text: "[END OF SHAREHOLDERS AGREEMENT]", bold: true })]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("./document/Martech_Shareholders_Agreement_MANUAL_NUMBERING.docx", buffer);
  console.log("Document with manual numbering created successfully!");
});
