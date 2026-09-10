package org.prakritinetx.fieldflash.ui.wizard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.databinding.FragmentStep4VerifyBinding
import org.prakritinetx.fieldflash.engine.verification.VerificationResult
import org.prakritinetx.fieldflash.ui.MainActivity
import org.prakritinetx.fieldflash.ui.MainViewModel

class Step4VerifyFragment : Fragment() {

    private var _binding: FragmentStep4VerifyBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStep4VerifyBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupListeners()
        observeViewModel()

        if (viewModel.verificationResult.value == null) {
            viewModel.runVerification()
        }
    }

    private fun setupListeners() {
        binding.btnReVerify.setOnClickListener {
            binding.pbVerification.visibility = View.VISIBLE
            binding.tvVerificationStateText.text = "RUNNING VERIFICATION..."
            binding.tvVerificationStateText.setTextColor(requireContext().getColor(R.color.brand_secondary))
            viewModel.runVerification()
        }

        binding.btnProceedToGeotag.setOnClickListener {
            (activity as? MainActivity)?.navigateToStep(5)
        }
    }

    private fun observeViewModel() {
        viewModel.selectedPackage.observe(viewLifecycleOwner) { pkg ->
            binding.tvExpectedVersion.text = "Expected Version: ${pkg?.version ?: "v1.0.0"}"
        }

        viewModel.verificationResult.observe(viewLifecycleOwner) { result ->
            binding.pbVerification.visibility = View.GONE
            if (result == null) {
                binding.tvVerificationStateText.text = "AWAITING VERIFICATION"
                binding.tvVerificationStateText.setTextColor(requireContext().getColor(R.color.status_warning))
                binding.btnProceedToGeotag.isEnabled = false
                return@observe
            }

            when (result) {
                is VerificationResult.Success -> {
                    binding.tvVerificationStateText.text = "NODE VERIFIED SUCCESSFULLY [PASS]"
                    binding.tvVerificationStateText.setTextColor(requireContext().getColor(R.color.status_success))
                    binding.tvReportedVersion.text = "Reported from Board: ${result.reportedVersion}"
                    binding.tvReportedVersion.setTextColor(requireContext().getColor(R.color.status_success))
                    binding.tvNodeHardwareId.text = "Verified Node ID: ${result.nodeId}"
                    binding.tvVerificationLog.text = result.bootOutput.trim().ifBlank { "Clean boot confirmed." }
                    binding.btnProceedToGeotag.isEnabled = true
                }
                is VerificationResult.Mismatch -> {
                    binding.tvVerificationStateText.text = "VERIFICATION FAILED: VERSION MISMATCH [FAIL]"
                    binding.tvVerificationStateText.setTextColor(requireContext().getColor(R.color.status_error))
                    binding.tvReportedVersion.text = "Reported from Board: ${result.reportedVersion} (MISMATCH!)"
                    binding.tvReportedVersion.setTextColor(requireContext().getColor(R.color.status_error))
                    binding.tvVerificationLog.text = "Expected '${result.expectedVersion}' but board reported '${result.reportedVersion}'."
                    binding.btnProceedToGeotag.isEnabled = false
                }
                is VerificationResult.NoResponse -> {
                    binding.tvVerificationStateText.text = "VERIFICATION FAILED: NO BOOT RESPONSE [FAIL]"
                    binding.tvVerificationStateText.setTextColor(requireContext().getColor(R.color.status_error))
                    binding.tvReportedVersion.text = "Reported from Board: NO SERIAL RESPONSE"
                    binding.tvReportedVersion.setTextColor(requireContext().getColor(R.color.status_error))
                    binding.tvVerificationLog.text = "${result.errorMessage}\n\nRaw buffer: ${result.rawBuffer.take(200)}"
                    binding.btnProceedToGeotag.isEnabled = false
                }
                is VerificationResult.Failed -> {
                    binding.tvVerificationStateText.text = "VERIFICATION FAILED: ERROR [FAIL]"
                    binding.tvVerificationStateText.setTextColor(requireContext().getColor(R.color.status_error))
                    binding.tvVerificationLog.text = result.errorMessage
                    binding.btnProceedToGeotag.isEnabled = false
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

