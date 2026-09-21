# Bonus Lab 1: ThousandEyes

With ThousandEyes, you can get deeper visibility into your networks and see hop by hop network path for the calls on the desk phone. ThousandEyes endpoint agent is supported on Cisco Desk Phone 9861, 9871 and Video Phone 8875.

### **Module 1a: Accessing ThousandEyes Portal**

1. In the browser tab where you have dCloud Session View open, initiate a **Web Remote Desktop (Web RDP)** session to **User Workstation 1**.
      1. Click on **topology** icon.
      2. Click on **User Workstation 1**.
      3. Expand the **Remote Access** panel.
      4. Click on **Web RDP**.


        ![alt text](assets/image-62.png)

2. This will open a Web RDP session in a new browser window. Launch **Google Chrome** browser using the shortcut (double click) on the home screen. 

    ![alt text](assets/image-63.png)

3. Switch to a browser tab titled **Cisco dCloud**. If you do not see one, click on + sign to open a new tab and it should automatically open.

    ![alt text](assets/image-64.png)

4. Hover over the **Collaboration Admin Links** and it should open a menu. Click on **ThousandEyes Portal** from the list.

    ![alt text](assets/image-65.png)

5. Click on **Go to account** button.

    ![alt text](assets/image-66.png)

6. Close the cookies warning popup.

    ![alt text](assets/image-67.png)

7. You can now see the ThousandEyes Portal. 

    ![alt text](assets/image-68.png)


### **Module 1b: Enabling ThousandEyes in Collaboration Control Hub**

1. Continuing in the ThousandEyes portal, navigate to **Endpoint Experience** -> **Agent Settings**.

    ![alt text](assets/image-75.png)

2. Click on **+ New Endpoint Agent**

    ![alt text](assets/image-76.png)

3. Copy the **Connection String**. You will use this in a later step.

    ![alt text](assets/image-77.png)

4. Switch back to the browser tab where you are logged into the Collaboration Control Hub.
   
5. Navigate to **Management** -> **Devices** -> **Settings** -> **Settings**.

    ![alt text](assets/image-78.png)

6. Scroll down to the ThousandEyes section. Toggle the switch for **Enable ThousandEyes Agent** to ON and click on **+ Add** button.

    ![alt text](assets/image-79.png)

7. Paste the Connection String you copied from ThousandEyes Portal into the **Configure ThousandEyes Agents** window and click **Save**.

    ![alt text](assets/image-80.png)


### **Module 1c: Setting up the tests on ThousandEyes portal**

1. Continuing in the browser tab where you are logged in to Collaboration Control Hub, navigate to **Services** -> **Meetings** -> **Sites** and click on the **Site Name** listed there.
    ![alt text](assets/image-69.png)


2. Copy the first part of the **Site Name** before **.webex.com**. You will use this in a later step.

    ![alt text](assets/image-70.png)

3.  Switch back to the ThousandEyes Portal browser tab on Workstation 1 Web RDP session. Navigate to **Endpoint Experience** -> **Test Settings**.

    ![alt text](assets/image-71.png)

4.  Close the **Get started with Endpoint Experience** window if shown.
   
    ![alt text](assets/image-72.png)

5.  Click on **+ Monitor Application** button.
   
    ![alt text](assets/image-73.png)

6.  In **Monitor Application** window showing Step 1 of 3 - **Select an application**, scroll to the bottom and select **Webex**.

    ![alt text](assets/image-74.png)

7.  In **Monitor Application** window showing Step 2 of 3 - **Configure tests**, keep the other defaults and enter the Webex site ID you copied earlier in the **Your Webex Site ID Name** text box. Click on **Review Template**.

    ![alt text](assets/image-82.png)

8.  In **Monitor Application** window showing Step 3 of 3 - **Review application monitoring**, click **Next**.

    ![alt text](assets/image-83.png)

9.  You should get a confirmation that **Setup Completed Successfully**. Click **Done**.

    ![alt text](assets/image-84.png)

10. You will see two tests created in Test Settings section.

    ![alt text](assets/image-85.png)

### **Module 1d: Setting up API access to ThousandEyes in Collaboration Control Hub**

1. Continuing in the ThousandEyes portal, click on the arrow next to the user / account information shown in the top right corner.

    ![alt text](assets/image-86.png)

2. From the expanded user / account information panel, click on Profile button.

    ![alt text](assets/image-87.png)

3. Once User and Roles page opens, scroll down to the User API Tokens section and click on Create button next to OAuth Beater Token. 

    ![alt text](assets/image-88.png)

4. Once **OAuth Bearer Token** is generated, click on **Copy** button to copy it. Save this token in a text editor of your choice as you will need it in a sub-sequent step.

    ![alt text](assets/image-89.png)

5. Switch back to a browser tab where you are logged into Collaboration Control Hub. Navigate to **Management** -> **Organization Settings**. Scroll down to find **ThousandEyes** section. Toggle ON **Allow ThousandEyes API access**. 

    ![alt text](assets/image-90.png)

6. Enter the **OAuth Bearer Token** that was copied previously into the **Activate ThousandEyes Network Path Feature** dialog. Once the status shows as **Validated**, click on **Activate** button.

    ![alt text](assets/image-91.png)

7. Once the changes are applied, you will see **ThousandEyes account group** listed.

    ![alt text](assets/image-92.png)


### **Module 1e: Test call and validation**

1. Dial Smart Audio DID number <copy>**<w class="SmartAudioDid">Enter the Smart Audio DID in <a href="../overview#lab-access">Overview &gt; Lab Access</a></w>**</copy>. You can use the speed dial that you created in earlier step.
2. Keep the call on for a couple of minutes. Hang up the call after that.
3. In the browser tab where you are logged in to Collaboration Control Hub, navigate to **MANAGEMENT > Devices.** It will list the phone that you used to make a phone call. Select your **Cisco 98XX** device. 
4. On the device Overview page, scroll down to the **Support** section. Click on **Meetings & Calls** to navigate to **Troubleshooting** section.

    ![alt text](assets/image-93.png)

5. On the Troubleshooting page, scroll down to see the call that you made AFTER you enabled ThousandEyes.
    
    **Note:** It may take a few minutes for the end of call statistics to appear after the call ends. Wait for a few minutes or try out one of the bonus lab module in the meanwhile and return back to this.

    ![alt text](assets/image-94.png)

7. Click on the call record and observe that call summary page will open.

    ![alt text](assets/image-95.png)

8. Scroll down to see End-to-cloud Network path panel.

    ![alt text](assets/image-96.png)

9.  Hover over the solid line to see the statistics.

    ![alt text](assets/image-97.png)

10. Click over the solid line to see the Network path. Click  on **Copy ThousandEyes URL** link.

    ![alt text](assets/image-98.png)

11. Switch back to the ThousandEyes Portal browser tab on Workstation 1 Web RDP session. In the same browser tab, open a new tab, paste and open the link you copied. This will open **Endpoint Views** page in ThousandEyes portal for the specific phone and the exact time you selected. 

    ![alt text](assets/image-99.png)

12. Scroll down to **Path Visualization** section and increase the number of hopes to maximum to see the hop by hop network path.

    ![alt text](assets/image-100.png)
