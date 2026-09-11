# Lab 9: Custom Ringtone

Ringtone settings let you manage how the phone alerts users to incoming calls. The phones provide built-in ringtones and support custom ringtones. Your phone supports up to 10 custom ringtones. When configured, users can assign them to individual lines on the phone.

Make sure your ringtone files meet these requirements:

- File format: .raw or .rwb
- Sampling rates: 8 kHZ(narrowband) or 16 kHZ(wideband)
- Maximum file size: 960 KB
- The phone must have network access to the server hosting the ringtone files.

For more information about custom ringtone, visit this resource link: [Configure ringtones for 9800 Series and 8875 phones (Control Hub)](https://help.webex.com/en-us/article/z6rlebb/Configure-ringtones-for-9800-Series-and-8875-phones-(Control-Hub)). For this lab, follow the instructions below:

1. On the browser tab where you have Webex CH logged in. Navigate to **MANAGEMENT > Devices** on the left. It will list the Cisco 98XX phone registered.
2. Select **Cisco 98XX** from the list.
3. On the Device page go to **Configurations** > **All configurations**
4. On the Device configuration page search for key word <copy>**CustomRingtone**</copy>. From the filtered list choose **Phone > Ringtone > CustomRingtoneURL[1]**

    ![alt text](assets/image-13.png)

5. On the Custom Ringtone URL[1] page configure the following and click **All** in the configuration navigation menu.

    <copy>**[https://webexcc-sa.github.io/LAB-21216/lab-assets/cisco_synth4.raw](https://webexcc-sa.github.io/LAB-21216/lab-assets/cisco_synth4.raw)**</copy>

    ![alt text](assets/image-15.png)

6. From All configurations screen, navigate to **Lines > Line[1] > CallFeatureSettings**

    ![alt text](assets/image-16.png)

7. Set Ringtone to **Custom 1** and click **Next**.

    ![alt text](assets/image-17.png)

8. On the next page click **Apply**. Click **Close**.

9. Give phone few seconds to apply the changes.

10. Now use your mobile phone to dial the DID number shown for Charles Holland on the top left corner of the phone screen.

    ![alt text](assets/image-18.png)

11. Observe that phone plays Cisco Synth jingle as a ringtone.
