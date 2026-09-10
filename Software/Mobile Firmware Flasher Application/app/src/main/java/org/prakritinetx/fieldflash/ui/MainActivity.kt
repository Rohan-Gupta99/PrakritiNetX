package org.prakritinetx.fieldflash.ui

import android.content.Intent
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.databinding.ActivityMainBinding
import org.prakritinetx.fieldflash.ui.settings.SettingsFragment
import org.prakritinetx.fieldflash.ui.wizard.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: MainViewModel by viewModels()

    private var currentStep = 1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupStepTabs()
        setupListeners()
        observePendingQueue()

        if (savedInstanceState == null) {
            navigateToStep(1)
        }

        handleUsbIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleUsbIntent(intent)
    }

    private fun handleUsbIntent(intent: Intent?) {
        if (intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED) {
            val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
            if (device != null) {
                Toast.makeText(this, "USB Device Attached: ${device.deviceName}", Toast.LENGTH_SHORT).show()
                viewModel.appendLog("USB Device Attached: ${device.deviceName} (VID 0x${Integer.toHexString(device.vendorId)})")
                // Auto switch to connect tab if on step 1 or 2
                if (currentStep == 1) {
                    navigateToStep(2)
                }
            }
        }
    }

    private fun setupStepTabs() {
        binding.tabStep1.setOnClickListener { navigateToStep(1) }
        binding.tabStep2.setOnClickListener { navigateToStep(2) }
        binding.tabStep3.setOnClickListener { navigateToStep(3) }
        binding.tabStep4.setOnClickListener { navigateToStep(4) }
        binding.tabStep5.setOnClickListener { navigateToStep(5) }
    }

    private fun setupListeners() {
        binding.btnSettings.setOnClickListener {
            openSettings()
        }
    }

    private fun observePendingQueue() {
        viewModel.pendingSyncCount.observe(this) { count ->
            if (count > 0) {
                binding.tvQueueBadge.visibility = View.VISIBLE
                binding.tvQueueBadge.text = "$count Pending"
                binding.tvQueueBadge.setOnClickListener { openSettings() }
            } else {
                binding.tvQueueBadge.visibility = View.GONE
            }
        }
    }

    fun navigateToStep(step: Int) {
        currentStep = step
        updateTabHighlight(step)

        val fragment: Fragment = when (step) {
            1 -> Step1FirmwareSelectFragment()
            2 -> Step2ConnectFragment()
            3 -> Step3FlashFragment()
            4 -> Step4VerifyFragment()
            5 -> Step5GeotagFragment()
            else -> Step1FirmwareSelectFragment()
        }

        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    fun openSettings() {
        resetTabHighlights()
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, SettingsFragment())
            .addToBackStack(null)
            .commit()
    }

    private fun updateTabHighlight(activeStep: Int) {
        val colorActive = getColor(R.color.brand_primary)
        val colorInactive = getColor(R.color.text_muted)

        binding.tabStep1.setTextColor(if (activeStep == 1) colorActive else colorInactive)
        binding.tabStep2.setTextColor(if (activeStep == 2) colorActive else colorInactive)
        binding.tabStep3.setTextColor(if (activeStep == 3) colorActive else colorInactive)
        binding.tabStep4.setTextColor(if (activeStep == 4) colorActive else colorInactive)
        binding.tabStep5.setTextColor(if (activeStep == 5) colorActive else colorInactive)
    }

    private fun resetTabHighlights() {
        val colorInactive = getColor(R.color.text_muted)
        binding.tabStep1.setTextColor(colorInactive)
        binding.tabStep2.setTextColor(colorInactive)
        binding.tabStep3.setTextColor(colorInactive)
        binding.tabStep4.setTextColor(colorInactive)
        binding.tabStep5.setTextColor(colorInactive)
    }

    override fun onDestroy() {
        super.onDestroy()
        viewModel.serialManager.close()
    }
}

